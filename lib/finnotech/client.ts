import { Agent } from "undici";
import { FINNOTECH_SCOPES, finnotechBaseUrl, finnotechClientId, finnotechConfigured, finnotechTimeoutMs } from "@/lib/finnotech/config";
import { redactSecrets } from "@/lib/finnotech/redact";

const REFRESH_SKEW_MS = 60_000;
const MAX_ATTEMPTS = 3;
const CONNECT_TIMEOUT_MS = 4_000;

/**
 * Shared pool for token and API calls. A stalled TCP handshake fails in ~4s
 * instead of waiting out the read timeout, and the socket stays open for the
 * token request and the call that follows it.
 */
export const finnotechDispatcher = new Agent({
  connectTimeout: CONNECT_TIMEOUT_MS,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
});

type FetchInit = RequestInit & { dispatcher?: Agent };

export class FinnotechError extends Error {
  constructor(
    public code: string,
    public httpStatus = 0,
    /** Provider `error.message`, unredacted. Log and UI callers must mask it. */
    public providerMessage = "",
    /** JSON of the error envelope fields (no result payload). */
    public providerBody = ""
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
  responseCode?: string;
  message?: string;
  result?: T;
  error?: { code?: string; message?: string };
};

type ErrorNode = {
  code?: unknown;
  syscall?: unknown;
  cause?: unknown;
  name?: unknown;
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

function errorNodes(err: unknown): ErrorNode[] {
  const nodes: ErrorNode[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    nodes.push(current as ErrorNode);
    current = (current as ErrorNode).cause;
  }
  return nodes;
}

function stringField(nodes: ErrorNode[], key: "code" | "syscall"): string[] {
  return nodes.flatMap((node) => (typeof node[key] === "string" && node[key] ? [node[key] as string] : []));
}

/** Deepest cause code, else a useful error name. Safe to log. */
export function networkCauseCode(err: unknown): string {
  const nodes = errorNodes(err);
  const codes = stringField(nodes, "code");
  if (codes.length) return codes[codes.length - 1];
  for (const node of nodes) {
    if (typeof node.name === "string" && node.name !== "Error" && node.name !== "TypeError") return node.name;
  }
  return "unknown";
}

/**
 * Nothing reached Finnotech. UND_ERR_CONNECT_TIMEOUT and ECONNREFUSED are
 * connect-phase. ECONNRESET counts only when the syscall is still `connect`.
 */
export function isConnectFailure(err: unknown): boolean {
  const nodes = errorNodes(err);
  const codes = stringField(nodes, "code");
  if (codes.includes("UND_ERR_CONNECT_TIMEOUT") || codes.includes("ECONNREFUSED")) return true;
  return codes.includes("ECONNRESET") && stringField(nodes, "syscall").includes("connect");
}

function isReadTimeout(err: unknown): boolean {
  if (isConnectFailure(err)) return false;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return true;
  const codes = stringField(errorNodes(err), "code");
  return codes.includes("UND_ERR_HEADERS_TIMEOUT") || codes.includes("UND_ERR_BODY_TIMEOUT");
}

function isPostSendRetryable(err: unknown): boolean {
  if (err instanceof FinnotechError) {
    return err.httpStatus === 502 || err.httpStatus === 503 || err.httpStatus === 504;
  }
  if (isReadTimeout(err)) return true;
  return err instanceof TypeError;
}

function isOtpVerify(path: string) {
  const clean = path.split("?")[0];
  return clean.endsWith("/otp/verify");
}

function shouldRetry(input: FinnotechCall, err: unknown, attempt: number): boolean {
  // A read timeout means the verify request may already have been accepted.
  if (isOtpVerify(input.path) && isReadTimeout(err)) return false;
  if (isConnectFailure(err)) return attempt < MAX_ATTEMPTS;
  if (!isPostSendRetryable(err)) return false;
  const idempotent = input.idempotent ?? input.method === "GET";
  const budget = idempotent ? MAX_ATTEMPTS : 2;
  return attempt < budget;
}

function backoffMs(attempt: number) {
  return 50 * 2 ** (attempt - 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finnotechError(res: Response, data: Envelope<Record<string, unknown>> | null) {
  const code = data?.error?.code || `http_${res.status}`;
  const message =
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" ? data.message : "");
  const body = JSON.stringify({
    status: data?.status ?? null,
    responseCode: data?.responseCode ?? null,
    message: typeof data?.message === "string" ? data.message : null,
    error: data?.error ?? null,
  });
  return new FinnotechError(code, res.status, message, body);
}

function logFinnotechFailure(method: string, path: string, err: FinnotechError) {
  if (err.httpStatus >= 400 && err.httpStatus < 500) {
    console.error(
      "finnotech_http",
      method,
      path,
      err.httpStatus,
      err.code,
      redactSecrets(err.providerMessage),
      redactSecrets(err.providerBody)
    );
    return;
  }
  console.error("finnotech_http", method, path, err.httpStatus, err.code);
}

async function readJson(res: Response): Promise<Envelope<Record<string, unknown>>> {
  const data = (await res.json().catch(() => null)) as Envelope<Record<string, unknown>> | null;
  if (!res.ok || !data || data.status === "FAILED") {
    throw finnotechError(res, data);
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
    dispatcher: finnotechDispatcher,
    signal: AbortSignal.timeout(finnotechTimeoutMs()),
  } as FetchInit);
  let data: Envelope<Record<string, unknown>>;
  try {
    data = await readJson(res);
  } catch (err) {
    if (err instanceof FinnotechError && err.httpStatus >= 400 && err.httpStatus < 500) {
      logFinnotechFailure("POST", path, err);
    }
    throw err;
  }
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

/** Mint or refresh. Retryable stalls get three attempts with backoff. */
async function withTokenRetries(run: () => Promise<string>) {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (err) {
      last = err;
      const retryable = isConnectFailure(err) || isPostSendRetryable(err);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
    }
  }
  throw last;
}

async function mint(now: number) {
  if (!finnotechConfigured()) throw new FinnotechError("not_configured", 0);
  return withTokenRetries(() =>
    tokenRequest(
      {
        grant_type: "client_credentials",
        nid: process.env.FINNOTECH_NID!.trim(),
        scopes: FINNOTECH_SCOPES,
      },
      "/dev/v2/oauth2/token",
      now
    )
  );
}

async function refreshOrMint(now: number) {
  const refreshToken = cache?.refreshToken;
  if (!refreshToken) return mint(now);
  try {
    return await withTokenRetries(() =>
      tokenRequest(
        {
          grant_type: "refresh_token",
          token_type: "CLIENT-CREDENTIAL",
          refresh_token: refreshToken,
        },
        "/dev/v2/oauth2/token/refresh",
        now
      )
    );
  } catch (err) {
    cache = null;
    console.error("finnotech_refresh", err instanceof FinnotechError ? err.code : networkCauseCode(err));
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
  /**
   * GET retries up to 3 times. POST post-send errors retry once.
   * Connect failures retry on every method, including POST, because nothing was sent.
   * otp/verify is not retried on a read timeout.
   */
  idempotent?: boolean;
};

export async function finnotechCall<T>(
  input: FinnotechCall,
  now = Date.now()
): Promise<{ trackId: string; result: T }> {
  const trackId = newTrackId();
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await authorized(input, trackId, now, false);
    } catch (err) {
      last = err;
      if (!shouldRetry(input, err, attempt)) break;
      await sleep(backoffMs(attempt));
    }
  }
  if (last instanceof FinnotechError) throw last;
  console.error("finnotech_network", input.method, input.path, networkCauseCode(last));
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
    dispatcher: finnotechDispatcher,
    signal: AbortSignal.timeout(finnotechTimeoutMs()),
  } as FetchInit);
  let data: Envelope<T>;
  try {
    data = (await readJson(res)) as Envelope<T>;
  } catch (err) {
    if (err instanceof FinnotechError) logFinnotechFailure(input.method, input.path, err);
    throw err;
  }
  return { trackId: data.trackId || trackId, result: (data.result ?? ({} as T)) };
}

export function safeFinnotechLog(label: string, err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(label, redactSecrets(raw));
}
