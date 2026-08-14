import type { InstrumentId } from "@/lib/market/instruments";

export type CoreApiError = {
  ok: false;
  error: string;
  message?: string;
};

async function coreFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json()) as T & CoreApiError;
  if (!res.ok || (data as CoreApiError).ok === false) {
    const err = data as CoreApiError;
    throw new Error(err.message || err.error || `core_api_${res.status}`);
  }
  return data;
}

export type UiQuote = {
  id: string;
  instrument: InstrumentId;
  fee: number;
  net: number;
  gross: number;
  goldMg: number;
  pricePerGram: number;
  expiresAt: string;
  status: string;
};

export type UiWallet = {
  rialAvailable: number;
  rialPending: number;
  goldMg: number;
  silverMg: number;
  copperMg: number;
};

export type UiTx = {
  id: string;
  trackingCode: string;
  type: string;
  instrument: InstrumentId;
  goldMg: number;
  amountRial: number;
  feeRial: number;
  pricePerGram: number;
  status: string;
  createdAt: string;
  timeline: { label: string; done: boolean; at?: string }[];
  paymentRef?: string;
};

export const coreApi = {
  async wallet() {
    return coreFetch<{
      ok: true;
      wallet: { ui: UiWallet };
      avgBuyTomanPerGram: { gold18: number; silver925: number; copper: number };
    }>("/api/core/wallet");
  },

  async dashboard() {
    return coreFetch<{
      ok: true;
      executionMode: string;
      wallet: { ui: UiWallet };
    }>("/api/core/dashboard");
  },

  async transactions() {
    return coreFetch<{ ok: true; ui: UiTx[] }>("/api/core/transactions");
  },

  async issueQuote(input: {
    instrument: InstrumentId;
    side: "BUY" | "SELL";
    inputMode: "RIAL_AMOUNT" | "METAL_WEIGHT";
    requestedToman?: number;
    requestedGrams?: number;
  }) {
    return coreFetch<{ ok: true; quote: { id: string; expiresAt: string; ui: UiQuote } }>(
      "/api/core/quotes",
      { method: "POST", body: JSON.stringify(input) }
    );
  },

  async executeTrade(quoteId: string, idempotencyKey: string) {
    return coreFetch<{ ok: true; trade: { id: string; trackingCode: string; ui: UiTx } }>(
      "/api/core/trades",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ quoteId, idempotencyKey }),
      }
    );
  },

  async sandboxDeposit(toman: number, idempotencyKey: string) {
    return coreFetch<{ ok: true; id: string; trackingCode: string }>(
      "/api/core/sandbox/deposit",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ toman, idempotencyKey }),
      }
    );
  },

  async sandboxSession(userId: string) {
    return coreFetch<{ ok: true; userId: string }>("/api/core/sandbox/session", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },
};

export { coreFetch };
