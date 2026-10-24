import { FINNOTECH_SCOPES, finnotechBaseUrl, finnotechClientId, finnotechConfigured, finnotechTimeoutMs } from "@/lib/finnotech/config";
import { redactSecrets } from "@/lib/finnotech/redact";

const REFRESH_SKEW_MS = 60_000;
const MAX_ATTEMPTS = 3;

export class FinnotechError extends Error {
  constructor(
    public code: string,
    public httpStatus = 0
  ) {
    super(`finnotech_${code}`);
    this.name = "FinnotechError";
  }
}

type CachedToken = {
  accessToken: string;
  refreshToken: string;
  lifeTimeMs: number;
  obtainedAt: number;
};

type Envelope<T> = {
  status?: string;
  trackId?: string;
  result?: T;
  error?: { code?: string; message?: string };
};

let cache: CachedToken | null = null;
let inflight: Promise<string> | null = null;

export function resetFinnotechAuthCache() {
  cache = null;
  inflight = null;
}

export function newTrackId() {
  return crypto.randomUUID();
}

function basicAuthHeader() {
  const id = finnotechClientId();
  const secret = process.env.FINNOTECH_CLIENT_SECRET?.trim() ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function dueForRefresh(token: CachedToken, now: number) {
  const skew = Math.min(REFRESH_SKEW_MS, Math.floor(token.lifeTimeMs / 2));
  return now >= token.obtainedAt + token.lifeTimeMs - skew;
}

function isRetryable(err: unknown) {
  if (err instanceof FinnotechError) {
    return err.httpStatus === 502 || err.httpStatus === 503 || err.httpStatus === 504;
  }
  if (err instanceof Error) {
    return err.name === "AbortError" || err.name === "TimeoutError" || err instanceof TypeError;
  }
  return false;
}

async function readJson(res: Response): Promise<Envelope<Record<string, unknown>>> {
  const data = (await res.json().catch(() => null)) as Envelope<Record<string, unknown>> | null;
  if (!res.ok || !data || data.status === "FAILED") {
    const code = data?.error?.code || `http_${res.status}`;
    throw new FinnotechError(code, res.status);
  }
  return data;
}

async function tokenRequest(body: Record<string, string>, path: string, now: number) {
  const res = await fetch(`${finnotechBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(finnotechTimeoutMs()),
  });
  const data = await readJson(res);
  const result = data.result ?? {};
  const accessToken = String(result.value ?? "");
  const refreshToken = String(result.refreshToken ?? "");
  const lifeTimeMs = Number(result.lifeTime ?? 0);
  if (!accessToken || !refreshToken || !Number.isFinite(lifeTimeMs) || lifeTimeMs <= 0) {
    throw new FinnotechError("token_incomplete", res.status);
  }
  cache = { accessToken, refreshToken, lifeTimeMs, obtainedAt: now };
  return accessToken;
}

async function mint(now: number) {
  if (!finnotechConfigured()) throw new FinnotechError("not_configured", 0);
  return tokenRequest(
    {
      grant_type: "client_credentials",
      nid: process.env.FINNOTECH_NID!.trim(),
      scopes: FINNOTECH_SCOPES,
    },
    "/dev/v2/oauth2/token",
    now
  );
}

async function refreshOrMint(now: number) {
  const refreshToken = cache?.refreshToken;
  if (!refreshToken) return mint(now);
  try {
    return await tokenRequest(
      {
        grant_type: "refresh_token",
        token_type: "CLIENT-CREDENTIAL",
        refresh_token: refreshToken,
      },
      "/dev/v2/oauth2/token/refresh",
      now
    );
  } catch (err) {
    cache = null;
    console.error(
      "finnotech_refresh",
      err instanceof FinnotechError ? err.code : "network"
    );
    return mint(now);
  }
}

export async function getFinnotechAccessToken(now = Date.now()) {
  if (cache && !dueForRefresh(cache, now)) return cache.accessToken;
  if (!inflight) {
    const pending = (cache?.refreshToken ? refreshOrMint(now) : mint(now)).finally(() => {
      inflight = null;
    });
    inflight = pending;
  }
  return inflight;
}

export type FinnotechCall = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** GET retries up to 3 times. POST retries once, and only on timeout or 502/503/504. */
  idempotent?: boolean;
};

export async function finnotechCall<T>(
  input: FinnotechCall,
  now = Date.now()
): Promise<{ trackId: string; result: T }> {
  const trackId = newTrackId();
  const idempotent = input.idempotent ?? input.method === "GET";
  const attempts = idempotent ? MAX_ATTEMPTS : 2;
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await authorized(input, trackId, now, false);
    } catch (err) {
      last = err;
      if (!isRetryable(err) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  if (last instanceof FinnotechError) throw last;
  console.error("finnotech_network", input.method, input.path);
  throw new FinnotechError("network", 0);
}

async function authorized<T>(
  input: FinnotechCall,
  trackId: string,
  now: number,
  refreshed: boolean
): Promise<{ trackId: string; result: T }> {
  const token = await getFinnotechAccessToken(now);
  try {
    return await once(input, trackId, token);
  } catch (err) {
    if (!refreshed && err instanceof FinnotechError && err.httpStatus === 401) {
      cache = null;
      return authorized(input, trackId, Date.now(), true);
    }
    throw err;
  }
}

async function once<T>(input: FinnotechCall, trackId: string, token: string) {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const url = new URL(`${finnotechBaseUrl()}${path}`);
  url.searchParams.set("trackId", trackId);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(finnotechTimeoutMs()),
  });
  let data: Envelope<T>;
  try {
    data = (await readJson(res)) as Envelope<T>;
  } catch (err) {
    if (err instanceof FinnotechError) {
      console.error("finnotech_http", input.method, input.path, err.httpStatus, err.code);
    }
    throw err;
  }
  return { trackId: data.trackId || trackId, result: (data.result ?? ({} as T)) };
}

export function safeFinnotechLog(label: string, err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(label, redactSecrets(raw));
}
