import { createHash, randomBytes } from "crypto";
import { ASSET_SPECS, type AssetCode } from "./assets";
import {
  DEFAULT_FEE_SNAPSHOT,
  DEFAULT_SPREAD_SNAPSHOT,
  type FeeSnapshot,
  type SpreadSnapshot,
} from "./fees";
import { assertSystemSeedAllowed } from "./account-policy";
import { getBalance, line, postJournal, requireBalance } from "./ledger";
import {
  assertAssetSideEnabled,
  getExecutionMode,
  getFeatureFlags,
  getKillSwitches,
  postgresRequired,
  sandboxDepositAllowed,
  sandboxSeedAllowed,
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
  seedCashIrr?: Irr;
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
  kind: "CORE_MILESTONE_PLACEHOLDER";
  inventoryComplete: false;
  customerLiabilityComplete: false;
  asset: AssetCode;
  platformFreeControlledUg: Microgram;
  /** Not aggregated in this milestone. Null means unavailable — never treat as 0. */
  customerMetalLiabilityUg: null;
  openSoftReservationsUg: Microgram;
  restrictedFreeUg: Microgram;
  safetyBufferUg: Microgram;
  availableToSellUg: Microgram;
  weightedAverageCostIrrPerGram: Irr;
  netPositionUg: Microgram;
  note: string;
};

function trackingCode() {
  return `GRM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class FinancialCore {
  private seeded = false;
  constructor(private readonly deps: EngineDeps) {
    this.assertStoreForMode();
  }

  private assertStoreForMode() {
    const mode = this.mode();
    if (postgresRequired(mode) && this.deps.store.persistence !== "postgres") {
      throw new CoreError(
        "store_not_allowed",
        `${mode} requires Postgres; MemoryCoreStore is forbidden`,
        500
      );
    }
  }

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

  /**
   * Ensures the chart of accounts. Does NOT manufacture inventory or cash.
   * PRODUCTION / CLOSED_BETA start at 0 unless an approved opening is posted.
   * SANDBOX may SYSTEM_SEED only when SANDBOX_SEED_ENABLED is explicitly true.
   */
  async bootstrap() {
    this.assertStoreForMode();
    await ensurePlatformAccounts(this.deps.store);
    if (this.seeded) return;
    this.seeded = true;

    if (!sandboxSeedAllowed(this.mode(), this.flags())) {
      return;
    }
    assertSystemSeedAllowed(this.mode());

    for (const asset of Object.keys(ASSET_SPECS) as AssetCode[]) {
      const qty = this.deps.seedInventoryUg?.[asset] ?? 0n;
      if (qty <= 0n) continue;
      await this.postOpening({
        accountCode: "PLATFORM_AVAILABLE",
        asset,
        amount: qty,
        refType: "SYSTEM_SEED",
        reason: "SEED_INVENTORY",
        refId: `seed:${asset}`,
      });
    }
    const seedCash = this.deps.seedCashIrr ?? 0n;
    if (seedCash > 0n) {
      await this.postOpening({
        accountCode: "PLATFORM_CASH_CONTROL",
        asset: "IRR",
        amount: seedCash,
        refType: "SYSTEM_SEED",
        reason: "SEED_CASH",
        refId: "seed:IRR",
      });
    }
  }

  async postOpening(input: {
    accountCode: "PLATFORM_AVAILABLE" | "PLATFORM_CASH_CONTROL" | "USER_AVAILABLE";
    holderId?: string;
    asset: AssetCode | "IRR";
    amount: bigint;
    refType: "SYSTEM_SEED" | "MIGRATION" | "APPROVED_OPENING_BALANCE";
    reason?: string;
    refId?: string;
  }): Promise<string> {
    if (input.amount <= 0n) {
      throw new CoreError("invalid_amount", "Opening amount must be positive");
    }
    if (input.refType === "SYSTEM_SEED") {
      if (this.mode() === "PRODUCTION") {
        throw new CoreError("opening_forbidden", "SYSTEM_SEED is forbidden in PRODUCTION", 403);
      }
      assertSystemSeedAllowed(this.mode());
      if (!this.flags().SANDBOX_SEED_ENABLED) {
        throw new CoreError("opening_forbidden", "SANDBOX_SEED_ENABLED is not set", 403);
      }
    }
    const holderId = input.holderId ?? PLATFORM_HOLDER;
    await ensurePlatformAccounts(this.deps.store);
    const journalId = newId("jnl");
    await postJournal(this.deps.store, {
      id: journalId,
      createdAt: this.now().toISOString(),
      reason: input.reason ?? "APPROVED_OPENING",
      refType: input.refType,
      refId: input.refId ?? journalId,
      lines: [
        line("PLATFORM_OPENING", PLATFORM_HOLDER, input.asset, input.amount, 0n),
        line(input.accountCode, holderId, input.asset, 0n, input.amount),
      ],
    });
    return journalId;
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

    const requestHash = hashPayload({
      operation: "SANDBOX_DEPOSIT",
      amountIrr: amountIrr.toString(),
    });

    return this.deps.store.withTransaction(async () => {
      const claim = await this.deps.store.claimIdempotency({
        key: idempotencyKey,
        userId,
        operation: "SANDBOX_DEPOSIT",
        method: "POST",
        path: "/api/core/sandbox/deposit",
        requestHash,
        responseJson: null,
        status: "IN_PROGRESS",
        createdAt: this.now().toISOString(),
      });
      if (claim.kind === "conflict") {
        throw new CoreError(
          "idempotency_conflict",
          "Idempotency key reused with a different request",
          409
        );
      }
      if (claim.kind === "in_progress") {
        throw new CoreError(
          "idempotency_in_progress",
          "Request is already in progress",
          409
        );
      }
      if (claim.kind === "replay" && claim.record.responseJson) {
        return JSON.parse(claim.record.responseJson) as { id: string; trackingCode: string };
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
        payloadJson: JSON.stringify({
          id,
          userId,
          irr: amountIrr.toString(),
          simulated: true,
          note: "SANDBOX simulated funding — not a real PSP settlement",
        }),
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
        operation: "SANDBOX_DEPOSIT",
        method: "POST",
        path: "/api/core/sandbox/deposit",
        requestHash,
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

  private async availableToSellUg(asset: AssetCode): Promise<Microgram> {
    const platformFree = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_AVAILABLE",
      asset
    );
    const restricted = await getBalance(
      this.deps.store,
      PLATFORM_HOLDER,
      "PLATFORM_RESTRICTED",
      asset
    );
    const safety = this.deps.safetyBufferUg?.[asset] ?? 0n;
    let available = platformFree - safety - restricted;
    if (available < 0n) available = 0n;
    return available;
  }

  /**
   * CORE_MILESTONE_PLACEHOLDER — inventory lots, custody, and customer metal
   * liability are not implemented. Do not treat these figures as production treasury truth.
   * `customerMetalLiabilityUg` is null (unavailable), never a fake 0.
   */
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
    const available = await this.availableToSellUg(asset);

    const wac = await this.deps.store.getCostBasis(PLATFORM_HOLDER, asset);
    const wacPerGram =
      wac.quantityUg > 0n ? mulDivFloor(wac.costIrr, UG_PER_GRAM, wac.quantityUg) : 0n;

    return {
      kind: "CORE_MILESTONE_PLACEHOLDER",
      inventoryComplete: false,
      customerLiabilityComplete: false,
      asset,
      platformFreeControlledUg: platformFree,
      customerMetalLiabilityUg: null,
      openSoftReservationsUg: openSoft,
      restrictedFreeUg: restricted,
      safetyBufferUg: safety,
      availableToSellUg: available,
      weightedAverageCostIrrPerGram: wacPerGram,
      netPositionUg: platformFree + platformReserved - restricted,
      note: "Inventory lots, custody, and customer metal liability are not implemented. Do not treat these figures as production treasury truth.",
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
    return this.deps.store.withTransaction(() =>
      this.deps.store.withAdvisoryLock(`quote:${quote.id}`, run)
    );
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
    const requestedIrr =
      input.inputMode === "RIAL_AMOUNT" ? (input.requestedIrr ?? null) : null;
    const requestedWeightUg =
      input.inputMode === "METAL_WEIGHT" ? (input.requestedWeightUg ?? null) : null;
    if (input.inputMode === "RIAL_AMOUNT" && !(requestedIrr && requestedIrr > 0n)) {
      throw new CoreError("invalid_amount", "RIAL_AMOUNT requires requestedIrr > 0");
    }
    if (input.inputMode === "METAL_WEIGHT" && !(requestedWeightUg && requestedWeightUg > 0n)) {
      throw new CoreError("invalid_amount", "METAL_WEIGHT requires requestedWeightUg > 0");
    }
    const computed = computeQuote({
      side: input.side,
      inputMode: input.inputMode,
      requestedIrr: requestedIrr ?? 0n,
      requestedWeightUg: requestedWeightUg ?? 0n,
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

    return this.deps.store.withTransaction(async () => {
      return this.deps.store.withAdvisoryLock(lockKey, async () => {
      if (input.side === "BUY") {
        const available = await this.availableToSellUg(input.asset);
        if (available < computed.weightUg) {
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
    });
  }

  async executeTrade(input: {
    userId: string;
    quoteId: string;
    idempotencyKey: string;
  }): Promise<Trade> {
    await this.bootstrap();
    await ensureUserAccounts(this.deps.store, input.userId);

    const requestHash = hashPayload({
      operation: "TRADE_EXECUTE",
      quoteId: input.quoteId,
    });

    return this.deps.store.withTransaction(async () => {
      const claim = await this.deps.store.claimIdempotency({
        key: input.idempotencyKey,
        userId: input.userId,
        operation: "TRADE_EXECUTE",
        method: "POST",
        path: "/api/core/trades",
        requestHash,
        responseJson: null,
        status: "IN_PROGRESS",
        createdAt: this.now().toISOString(),
      });
      if (claim.kind === "conflict") {
        throw new CoreError(
          "idempotency_conflict",
          "Idempotency key reused with a different request",
          409
        );
      }
      if (claim.kind === "in_progress") {
        throw new CoreError(
          "idempotency_in_progress",
          "Request is already in progress",
          409
        );
      }
      if (claim.kind === "replay") {
        const parsed = claim.record.responseJson
          ? (JSON.parse(claim.record.responseJson) as { tradeId: string })
          : null;
        if (parsed?.tradeId) {
          const t = await this.deps.store.getTrade(parsed.tradeId);
          if (t) return t;
        }
        throw new CoreError("internal", "Idempotent trade missing", 500);
      }

      return this.deps.store.withAdvisoryLock(`user:${input.userId}`, async () => {
      return this.deps.store.withAdvisoryLock(`quote:${input.quoteId}`, async () => {
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
          operation: "TRADE_EXECUTE",
          method: "POST",
          path: "/api/core/trades",
          requestHash,
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
