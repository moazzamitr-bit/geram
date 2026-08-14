import { createHash, randomBytes } from "crypto";
import { ASSET_SPECS, type AssetCode } from "./assets";
import {
  DEFAULT_FEE_SNAPSHOT,
  DEFAULT_SPREAD_SNAPSHOT,
  type FeeSnapshot,
  type SpreadSnapshot,
} from "./fees";
import { getBalance, line, postJournal, requireBalance } from "./ledger";
import {
  assertAssetSideEnabled,
  getExecutionMode,
  getFeatureFlags,
  getKillSwitches,
  sandboxDepositAllowed,
  type ExecutionMode,
  type FeatureFlags,
  type KillSwitches,
} from "./mode";
import { irr, irrToSafeTomanNumber, mulDivFloor, UG_PER_GRAM, type Irr, type Microgram } from "./money";
import type { PriceFeed } from "./price";
import { computeQuote, applySpread } from "./quote-math";
import { ensurePlatformAccounts, ensureUserAccounts, newId, type CoreStore } from "./store";
import {
  assertTradeTransition,
  CoreError,
  PLATFORM_HOLDER,
  type InputMode,
  type Quote,
  type QuoteSide,
  type Trade,
} from "./types";

export type EngineClock = () => Date;

export type EngineDeps = {
  store: CoreStore;
  prices: PriceFeed;
  now?: EngineClock;
  mode?: ExecutionMode;
  flags?: FeatureFlags;
  kills?: KillSwitches;
  fees?: FeeSnapshot;
  spread?: SpreadSnapshot;
  safetyBufferUg?: Partial<Record<AssetCode, Microgram>>;
  seedInventoryUg?: Partial<Record<AssetCode, Microgram>>;
};

export type IssueQuoteInput = {
  userId: string;
  asset: AssetCode;
  side: QuoteSide;
  inputMode: InputMode;
  requestedIrr?: Irr;
  requestedWeightUg?: Microgram;
};

export type WalletView = {
  rialAvailable: Irr;
  rialReserved: Irr;
  metals: Record<AssetCode, { availableUg: Microgram; reservedUg: Microgram }>;
};

export type TreasuryView = {
  asset: AssetCode;
  platformFreeControlledUg: Microgram;
  customerMetalLiabilityUg: Microgram;
  openSoftReservationsUg: Microgram;
  restrictedFreeUg: Microgram;
  safetyBufferUg: Microgram;
  availableToSellUg: Microgram;
  weightedAverageCostIrrPerGram: Irr;
  netPositionUg: Microgram;
};

function trackingCode() {
  return `GRM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class FinancialCore {
  private seeded = false;
  constructor(private readonly deps: EngineDeps) {}

  now() {
    return this.deps.now ? this.deps.now() : new Date();
  }

  mode(): ExecutionMode {
    return this.deps.mode ?? getExecutionMode();
  }

  flags(): FeatureFlags {
    return this.deps.flags ?? getFeatureFlags();
  }

  kills(): KillSwitches {
    return this.deps.kills ?? getKillSwitches();
  }

  fees(): FeeSnapshot {
    return this.deps.fees ?? DEFAULT_FEE_SNAPSHOT;
  }

  spread(): SpreadSnapshot {
    return this.deps.spread ?? DEFAULT_SPREAD_SNAPSHOT;
  }

  async bootstrap() {
    await ensurePlatformAccounts(this.deps.store);
    if (this.seeded) return;
    this.seeded = true;
    const defaults: Record<AssetCode, bigint> = {
      GOLD: UG_PER_GRAM * 100_000n,
      SILVER: UG_PER_GRAM * 1_000_000n,
      COPPER: UG_PER_GRAM * 10_000_000n,
      TEST_METAL: UG_PER_GRAM * 100_000n,
    };
    for (const asset of Object.keys(defaults) as AssetCode[]) {
      const qty = this.deps.seedInventoryUg?.[asset] ?? defaults[asset];
      if (qty <= 0n) continue;
      const existing = await getBalance(
        this.deps.store,
        PLATFORM_HOLDER,
        "PLATFORM_AVAILABLE",
        asset
      );
      if (existing > 0n) continue;
      await postJournal(this.deps.store, {
        id: newId("jnl"),
        createdAt: this.now().toISOString(),
        reason: "SEED_INVENTORY",
        refType: "opening",
        refId: `seed:${asset}`,
        lines: [
          line("PLATFORM_OPENING", PLATFORM_HOLDER, asset, qty, 0n),
          line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, asset, 0n, qty),
        ],
      });
    }
    const cash = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_CASH_CONTROL",
      "IRR"
    );
    if (cash === 0n) {
      const seedCash = 1_000_000_000_000_000n;
      await postJournal(this.deps.store, {
        id: newId("jnl"),
        createdAt: this.now().toISOString(),
        reason: "SEED_CASH",
        refType: "opening",
        refId: "seed:IRR",
        lines: [
          line("PLATFORM_OPENING", PLATFORM_HOLDER, "IRR", seedCash, 0n),
          line("PLATFORM_CASH_CONTROL", PLATFORM_HOLDER, "IRR", 0n, seedCash),
        ],
      });
    }
  }

  async sandboxDeposit(userId: string, amountIrr: Irr, idempotencyKey: string) {
    if (amountIrr <= 0n) throw new CoreError("invalid_amount", "deposit must be > 0");
    if (!sandboxDepositAllowed(this.mode(), this.flags())) {
      throw new CoreError(
        "sandbox_deposit_blocked",
        "Sandbox deposit is not allowed in this execution mode",
        403
      );
    }
    if (!this.kills().DEPOSIT_ENABLED) {
      throw new CoreError("deposit_disabled", "Deposits are disabled", 403);
    }
    await this.bootstrap();
    await ensureUserAccounts(this.deps.store, userId);

    return this.deps.store.withLock(`user:${userId}`, async () => {
      const existing = await this.deps.store.getIdempotency(userId, idempotencyKey);
      if (existing?.status === "COMPLETED" && existing.responseJson) {
        return JSON.parse(existing.responseJson) as { id: string; trackingCode: string };
      }
      const id = newId();
      const createdAt = this.now().toISOString();
      const tracking = trackingCode();
      await postJournal(this.deps.store, {
        id: newId("jnl"),
        createdAt,
        reason: "SANDBOX_DEPOSIT",
        refType: "sandbox_deposit",
        refId: id,
        lines: [
          line("PAYMENT_GATEWAY_CLEARING", PLATFORM_HOLDER, "IRR", amountIrr, 0n),
          line("USER_AVAILABLE", userId, "IRR", 0n, amountIrr),
        ],
      });
      await this.deps.store.insertSandboxDeposit({
        id,
        userId,
        irr: amountIrr,
        createdAt,
        trackingCode: tracking,
      });
      await this.deps.store.insertOutbox({
        id: newId("obx"),
        topic: "sandbox.deposit.credited",
        payloadJson: JSON.stringify({ id, userId, irr: amountIrr.toString() }),
        createdAt,
        processedAt: null,
        attempts: 0,
        status: "PENDING",
        lastError: null,
      });
      const result = { id, trackingCode: tracking };
      await this.deps.store.putIdempotency({
        key: idempotencyKey,
        userId,
        method: "POST",
        path: "/api/core/sandbox/deposit",
        requestHash: hashPayload({ amountIrr: amountIrr.toString() }),
        responseJson: JSON.stringify(result),
        status: "COMPLETED",
        createdAt,
      });
      return result;
    });
  }

  async wallet(userId: string): Promise<WalletView> {
    await this.bootstrap();
    await ensureUserAccounts(this.deps.store, userId);
    const metals = {} as WalletView["metals"];
    for (const asset of Object.keys(ASSET_SPECS) as AssetCode[]) {
      metals[asset] = {
        availableUg: await getBalance(this.deps.store, userId, "USER_AVAILABLE", asset),
        reservedUg: await getBalance(this.deps.store, userId, "USER_RESERVED", asset),
      };
    }
    return {
      rialAvailable: await getBalance(this.deps.store, userId, "USER_AVAILABLE", "IRR"),
      rialReserved: await getBalance(this.deps.store, userId, "USER_RESERVED", "IRR"),
      metals,
    };
  }

  async treasury(asset: AssetCode): Promise<TreasuryView> {
    await this.bootstrap();
    const platformFree = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_AVAILABLE",
      asset
    );
    const platformReserved = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_RESERVED",
      asset
    );
    const restricted = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_RESTRICTED",
      asset
    );
    const openSoft = await this.deps.store.openReservationQuantityUg(asset);
    const safety = this.deps.safetyBufferUg?.[asset] ?? 0n;
    let available = platformFree - safety - restricted;
    if (available < 0n) available = 0n;
    // Open reservations already live in PLATFORM_RESERVED, not PLATFORM_AVAILABLE.
    // Do not subtract customer liability — lots are consumed on buy.
    void platformReserved;
    void openSoft;

    const wac = await this.deps.store.getCostBasis(PLATFORM_HOLDER, asset);
    const wacPerGram =
      wac.quantityUg > 0n ? mulDivFloor(wac.costIrr, UG_PER_GRAM, wac.quantityUg) : 0n;

    // Customer liability is not stored as a single account; callers pass 0 here
    // unless they aggregate. Engine exposes 0 at platform level; use list later.
    return {
      asset,
      platformFreeControlledUg: platformFree,
      customerMetalLiabilityUg: 0n,
      openSoftReservationsUg: openSoft,
      restrictedFreeUg: restricted,
      safetyBufferUg: safety,
      availableToSellUg: available,
      weightedAverageCostIrrPerGram: wacPerGram,
      netPositionUg: platformFree + platformReserved - restricted,
    };
  }

  async expireQuoteIfNeeded(
    quote: Quote,
    opts?: { alreadyLocked?: boolean }
  ): Promise<Quote> {
    if (quote.status !== "ACTIVE") return quote;
    if (new Date(quote.expiresAt).getTime() > this.now().getTime()) return quote;
    const run = async () => {
      const fresh = await this.deps.store.getQuote(quote.id);
      if (!fresh || fresh.status !== "ACTIVE") return fresh ?? quote;
      if (new Date(fresh.expiresAt).getTime() > this.now().getTime()) return fresh;
      try {
        await this.deps.store.updateQuoteStatus(fresh.id, ["ACTIVE"], "EXPIRED");
      } catch {
        return (await this.deps.store.getQuote(quote.id)) ?? quote;
      }
      const res = await this.deps.store.getReservationByQuote(fresh.id);
      if (res && res.status === "OPEN" && fresh.side === "BUY") {
        await postJournal(this.deps.store, {
          id: newId("jnl"),
          createdAt: this.now().toISOString(),
          reason: "QUOTE_EXPIRE_RELEASE",
          refType: "quote",
          refId: fresh.id,
          lines: [
            line("PLATFORM_RESERVED", PLATFORM_HOLDER, fresh.asset, res.quantityUg, 0n),
            line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, fresh.asset, 0n, res.quantityUg),
          ],
        });
        await this.deps.store.updateReservationStatus(res.id, ["OPEN"], "RELEASED");
      }
      return { ...fresh, status: "EXPIRED" as const };
    };
    if (opts?.alreadyLocked) return run();
    return this.deps.store.withLock(`quote:${quote.id}`, run);
  }

  async issueQuote(input: IssueQuoteInput): Promise<Quote> {
    const spec = ASSET_SPECS[input.asset];
    if (!spec) throw new CoreError("unknown_asset", "Unknown asset");
    if (input.side === "BUY" && !spec.buyEnabled) {
      throw new CoreError("asset_disabled", "Buy disabled for asset", 403);
    }
    if (input.side === "SELL" && !spec.sellEnabled) {
      throw new CoreError("asset_disabled", "Sell disabled for asset", 403);
    }
    try {
      assertAssetSideEnabled(this.kills(), input.asset, input.side);
    } catch {
      throw new CoreError("kill_switch", "Trading is disabled for this asset/side", 403);
    }

    if (this.mode() === "PRODUCTION" && !spec.executableByDefault) {
      throw new CoreError(
        "not_executable",
        "This asset has no supplier-executable price in PRODUCTION",
        403
      );
    }

    await this.bootstrap();
    await ensureUserAccounts(this.deps.store, input.userId);

    const price = await this.deps.prices.getExecutable(input.asset);
    if (price.health === "UNAVAILABLE" || price.health === "PARSE_ERROR") {
      throw new CoreError("price_unavailable", "Execution price unavailable", 503);
    }
    if (price.stale || price.health === "STALE") {
      throw new CoreError("price_stale", "Execution price is stale", 503);
    }
    if (price.source === "seed") {
      throw new CoreError("price_unavailable", "Seed fallback cannot issue quotes", 503);
    }
    if (this.mode() === "PRODUCTION" && !price.permittedForProduction) {
      throw new CoreError(
        "not_executable",
        "Temporary public market data cannot issue production quotes",
        403
      );
    }

    const execution = applySpread(price.irrPerGram, input.side, this.spread());
    const requestedIrr = input.requestedIrr ?? 0n;
    const requestedWeightUg = input.requestedWeightUg ?? 0n;
    const computed = computeQuote({
      side: input.side,
      inputMode: input.inputMode,
      requestedIrr,
      requestedWeightUg,
      executionPriceIrrPerGram: execution,
      fees: this.fees(),
    });

    if (computed.weightUg < spec.minTradeUg || computed.weightUg > spec.maxTradeUg) {
      throw new CoreError("trade_limit", "Weight outside asset min/max");
    }
    const spendIrr = input.side === "BUY" ? computed.grossIrr : computed.netIrr;
    if (input.side === "BUY" && computed.grossIrr < spec.minTradeIrr) {
      throw new CoreError("trade_limit", "Amount below minimum");
    }
    void spendIrr;

    const createdAt = this.now();
    const quote: Quote = {
      id: newId(),
      userId: input.userId,
      asset: input.asset,
      side: input.side,
      inputMode: input.inputMode,
      requestedIrr,
      requestedWeightUg,
      referencePriceIrrPerGram: price.irrPerGram,
      executionPriceIrrPerGram: computed.executionPriceIrrPerGram,
      grossIrr: computed.grossIrr,
      feeIrr: computed.feeIrr,
      netIrr: computed.netIrr,
      weightUg: computed.weightUg,
      feeSnapshotJson: JSON.stringify({
        buyFeeBps: this.fees().buyFeeBps.toString(),
        buyFeeMinIrr: this.fees().buyFeeMinIrr.toString(),
        sellFeeBps: this.fees().sellFeeBps.toString(),
        sellFeeMinIrr: this.fees().sellFeeMinIrr.toString(),
      }),
      spreadSnapshotJson: JSON.stringify({
        buySpreadBps: this.spread().buySpreadBps.toString(),
        sellSpreadBps: this.spread().sellSpreadBps.toString(),
      }),
      priceSourceSnapshotJson: JSON.stringify({
        instrument: price.instrument,
        source: price.source,
        sourceMode: price.sourceMode,
        permittedForProduction: price.permittedForProduction,
        health: price.health,
        observedAt: price.observedAt,
        irrPerGram: price.irrPerGram.toString(),
      }),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + spec.quoteTtlMs).toISOString(),
      status: "ACTIVE",
    };

    const lockKey =
      input.side === "BUY" ? `asset:${input.asset}:inventory` : `user:${input.userId}`;

    return this.deps.store.withLock(lockKey, async () => {
      if (input.side === "BUY") {
        const tre = await this.treasury(input.asset);
        if (tre.availableToSellUg < computed.weightUg) {
          throw new CoreError("insufficient_inventory", "Not enough metal available to sell", 409);
        }
        const rial = await getBalance(this.deps.store, input.userId, "USER_AVAILABLE", "IRR");
        if (rial < computed.grossIrr) {
          throw new CoreError("insufficient_funds", "موجودی کیف پول کافی نیست.", 409);
        }
        await this.deps.store.insertQuote(quote);
        await postJournal(this.deps.store, {
          id: newId("jnl"),
          createdAt: quote.createdAt,
          reason: "BUY_SOFT_RESERVATION",
          refType: "quote",
          refId: quote.id,
          lines: [
            line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, input.asset, computed.weightUg, 0n),
            line("PLATFORM_RESERVED", PLATFORM_HOLDER, input.asset, 0n, computed.weightUg),
          ],
        });
        await this.deps.store.insertReservation({
          id: newId("rsv"),
          quoteId: quote.id,
          asset: input.asset,
          quantityUg: computed.weightUg,
          status: "OPEN",
          createdAt: quote.createdAt,
        });
      } else {
        await requireBalance(
          this.deps.store,
          input.userId,
          "USER_AVAILABLE",
          input.asset,
          computed.weightUg,
          `مقدار فلز قابل فروش کافی نیست.`
        );
        await this.deps.store.insertQuote(quote);
      }
      await this.deps.store.insertOutbox({
        id: newId("obx"),
        topic: "quote.issued",
        payloadJson: JSON.stringify({ quoteId: quote.id, asset: quote.asset, side: quote.side }),
        createdAt: quote.createdAt,
        processedAt: null,
        attempts: 0,
        status: "PENDING",
        lastError: null,
      });
      return quote;
    });
  }

  async executeTrade(input: {
    userId: string;
    quoteId: string;
    idempotencyKey: string;
  }): Promise<Trade> {
    await this.bootstrap();
    await ensureUserAccounts(this.deps.store, input.userId);

    return this.deps.store.withLock(`user:${input.userId}`, async () => {
      const existing = await this.deps.store.getIdempotency(input.userId, input.idempotencyKey);
      if (existing?.status === "COMPLETED" && existing.responseJson) {
        const parsed = JSON.parse(existing.responseJson) as { tradeId: string };
        const t = await this.deps.store.getTrade(parsed.tradeId);
        if (t) return t;
      }

      return this.deps.store.withLock(`quote:${input.quoteId}`, async () => {
      const quote0 = await this.deps.store.getQuote(input.quoteId);
      if (!quote0) throw new CoreError("not_found", "Quote not found", 404);
      if (quote0.userId !== input.userId) {
        throw new CoreError("forbidden", "Quote belongs to another user", 403);
      }

      const quote = await this.expireQuoteIfNeeded(quote0, { alreadyLocked: true });
      if (quote.status === "EXPIRED") {
        throw new CoreError("quote_expired", "Quote expired", 409);
      }
      if (quote.status !== "ACTIVE") {
        throw new CoreError("quote_unusable", `Quote is ${quote.status}`, 409);
      }

      const createdAt = this.now().toISOString();
      const trade: Trade = {
        id: newId(),
        userId: input.userId,
        quoteId: quote.id,
        asset: quote.asset,
        side: quote.side,
        status: "CREATED",
        weightUg: quote.weightUg,
        grossIrr: quote.grossIrr,
        feeIrr: quote.feeIrr,
        netIrr: quote.netIrr,
        idempotencyKey: input.idempotencyKey,
        createdAt,
        trackingCode: trackingCode(),
      };
      await this.deps.store.insertTrade(trade);

      try {
        assertTradeTransition("CREATED", "RESERVED");
        await this.deps.store.updateTrade(trade.id, ["CREATED"], { status: "RESERVED" });

        if (quote.side === "BUY") {
          await this.postBuy(quote, trade);
        } else {
          await this.postSell(quote, trade);
        }

        assertTradeTransition("RESERVED", "LEDGER_POSTED");
        await this.deps.store.updateTrade(trade.id, ["RESERVED"], { status: "LEDGER_POSTED" });
        assertTradeTransition("LEDGER_POSTED", "SETTLED");
        const settled = await this.deps.store.updateTrade(trade.id, ["LEDGER_POSTED"], {
          status: "SETTLED",
        });
        await this.deps.store.updateQuoteStatus(quote.id, ["ACTIVE"], "USED");

        await this.deps.store.insertOutbox({
          id: newId("obx"),
          topic: "trade.settled",
          payloadJson: JSON.stringify({
            tradeId: settled.id,
            quoteId: quote.id,
            asset: quote.asset,
            side: quote.side,
          }),
          createdAt,
          processedAt: null,
          attempts: 0,
          status: "PENDING",
          lastError: null,
        });
        await this.deps.store.putIdempotency({
          key: input.idempotencyKey,
          userId: input.userId,
          method: "POST",
          path: "/api/core/trades",
          requestHash: hashPayload({ quoteId: input.quoteId }),
          responseJson: JSON.stringify({ tradeId: settled.id }),
          status: "COMPLETED",
          createdAt,
        });
        return settled;
      } catch (err) {
        const failed = await this.deps.store.getTrade(trade.id);
        if (failed && (failed.status === "CREATED" || failed.status === "RESERVED")) {
          try {
            assertTradeTransition(failed.status, "FAILED");
            await this.deps.store.updateTrade(trade.id, [failed.status], { status: "FAILED" });
          } catch {
            /* already terminal */
          }
        }
        throw err;
      }
    });
    });
  }

  private async postBuy(quote: Quote, trade: Trade) {
    await requireBalance(
      this.deps.store,
      quote.userId,
      "USER_AVAILABLE",
      "IRR",
      quote.grossIrr,
      "موجودی کیف پول کافی نیست."
    );
    const res = await this.deps.store.getReservationByQuote(quote.id);
    if (!res || res.status !== "OPEN") {
      throw new CoreError("reservation_missing", "Buy reservation is not open", 409);
    }

    const metalCost = quote.netIrr;
    const fee = quote.feeIrr;
    await postJournal(this.deps.store, {
      id: newId("jnl"),
      createdAt: trade.createdAt,
      reason: "BUY_SETTLE",
      refType: "trade",
      refId: trade.id,
      lines: [
        line("USER_AVAILABLE", quote.userId, "IRR", quote.grossIrr, 0n),
        line("PLATFORM_FEE_REVENUE", PLATFORM_HOLDER, "IRR", 0n, fee),
        line("PLATFORM_CASH_CONTROL", PLATFORM_HOLDER, "IRR", 0n, metalCost),
        line("PLATFORM_RESERVED", PLATFORM_HOLDER, quote.asset, quote.weightUg, 0n),
        line("USER_AVAILABLE", quote.userId, quote.asset, 0n, quote.weightUg),
      ],
    });
    await this.deps.store.updateReservationStatus(res.id, ["OPEN"], "CONSUMED");
    await this.addUserCost(quote.userId, quote.asset, quote.weightUg, metalCost);
  }

  private async postSell(quote: Quote, trade: Trade) {
    await requireBalance(
      this.deps.store,
      quote.userId,
      "USER_AVAILABLE",
      quote.asset,
      quote.weightUg,
      "مقدار فلز قابل فروش کافی نیست."
    );
    const metalProceeds = quote.grossIrr;
    const fee = quote.feeIrr;
    const net = quote.netIrr;
    await postJournal(this.deps.store, {
      id: newId("jnl"),
      createdAt: trade.createdAt,
      reason: "SELL_SETTLE",
      refType: "trade",
      refId: trade.id,
      lines: [
        line("USER_AVAILABLE", quote.userId, quote.asset, quote.weightUg, 0n),
        line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, quote.asset, 0n, quote.weightUg),
        line("PLATFORM_CASH_CONTROL", PLATFORM_HOLDER, "IRR", metalProceeds, 0n),
        line("PLATFORM_FEE_REVENUE", PLATFORM_HOLDER, "IRR", 0n, fee),
        line("USER_AVAILABLE", quote.userId, "IRR", 0n, net),
      ],
    });
    await this.reduceUserCost(quote.userId, quote.asset, quote.weightUg);
  }

  private async addUserCost(userId: string, asset: AssetCode, qty: Microgram, costIrr: Irr) {
    const row = await this.deps.store.getCostBasis(userId, asset);
    await this.deps.store.setCostBasis({
      holderId: userId,
      asset,
      quantityUg: row.quantityUg + qty,
      costIrr: row.costIrr + costIrr,
    });
  }

  private async reduceUserCost(userId: string, asset: AssetCode, qty: Microgram) {
    const row = await this.deps.store.getCostBasis(userId, asset);
    if (row.quantityUg <= 0n) {
      await this.deps.store.setCostBasis({ holderId: userId, asset, quantityUg: 0n, costIrr: 0n });
      return;
    }
    const costRemoved = mulDivFloor(row.costIrr, qty, row.quantityUg);
    const nextQty = row.quantityUg - qty;
    await this.deps.store.setCostBasis({
      holderId: userId,
      asset,
      quantityUg: nextQty < 0n ? 0n : nextQty,
      costIrr: nextQty <= 0n ? 0n : row.costIrr - costRemoved,
    });
  }

  async processOutbox(handler?: (event: { id: string; topic: string; payloadJson: string }) => Promise<void>) {
    const pending = await this.deps.store.listPendingOutbox(50);
    for (const event of pending) {
      try {
        await handler?.(event);
        await this.deps.store.markOutboxProcessed(event.id);
      } catch (err) {
        await this.deps.store.markOutboxFailed(
          event.id,
          err instanceof Error ? err.message : "outbox_failed"
        );
      }
    }
  }

  costBasisTomanPerGram = async (userId: string, asset: AssetCode): Promise<number> => {
    const row = await this.deps.store.getCostBasis(userId, asset);
    if (row.quantityUg <= 0n) return 0;
    const irrPerGram = mulDivFloor(row.costIrr, UG_PER_GRAM, row.quantityUg);
    return irrToSafeTomanNumber(irrPerGram);
  };

  listActivity = async (userId: string) => {
    const trades = await this.deps.store.listTradesForUser(userId, 100);
    const deposits = await this.deps.store.listSandboxDeposits(userId);
    return { trades, deposits };
  };

  getQuoteForUser = async (userId: string, quoteId: string) => {
    const q = await this.deps.store.getQuote(quoteId);
    if (!q || q.userId !== userId) return null;
    return this.expireQuoteIfNeeded(q);
  };

  getTradeForUser = async (userId: string, tradeId: string) => {
    const t = await this.deps.store.getTrade(tradeId);
    if (!t || t.userId !== userId) return null;
    return t;
  };
}

export function feesFromCommercePercent(input: {
  plus: boolean;
  buyFeePercentFree: number;
  buyFeePercentPlus: number;
  buyFeeMinTomanFree: number;
  buyFeeMinTomanPlus: number;
  sellFeePercentFree: number;
  sellFeePercentPlus: number;
  sellFeeMinTomanFree: number;
  sellFeeMinTomanPlus: number;
}): FeeSnapshot {
  const pct = input.plus ? input.buyFeePercentPlus : input.buyFeePercentFree;
  const sellPct = input.plus ? input.sellFeePercentPlus : input.sellFeePercentFree;
  const buyMin = input.plus ? input.buyFeeMinTomanPlus : input.buyFeeMinTomanFree;
  const sellMin = input.plus ? input.sellFeeMinTomanPlus : input.sellFeeMinTomanFree;
  return {
    buyFeeBps: irr(Math.round(pct * 10_000)),
    buyFeeMinIrr: irr(buyMin) * 10n,
    sellFeeBps: irr(Math.round(sellPct * 10_000)),
    sellFeeMinIrr: irr(sellMin) * 10n,
  };
}
