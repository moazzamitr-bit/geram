import { NextResponse } from "next/server";

export async function readAuthBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      if (value == null) continue;
      out[key] = String(value);
    }
    return out;
  }
  const form = await request.formData().catch(() => null);
  const out: Record<string, string> = {};
  if (!form) return out;
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Redirect using the public host, not Next's internal request.url. */
export function redirectTo(request: Request, pathWithQuery: string) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0].trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (!host) return NextResponse.redirect(new URL(pathWithQuery, request.url), 303);
  const proto = forwardedProto || new URL(request.url).protocol.replace(":", "") || "https";
  return NextResponse.redirect(new URL(pathWithQuery, `${proto}://${host}`), 303);
}

/** Native form posts should redirect. JSON fetches stay on the page. */
export function wantsHtml(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return false;
  return (
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data")
  );
}

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  }
  // Next often rewrites request.url to an internal host. Trust the headers the
  // browser and the reverse proxy actually send.
  const allowed = new Set<string>();
  for (const header of ["host", "x-forwarded-host"]) {
    const value = request.headers.get(header);
    if (value) allowed.add(value.split(",")[0].trim());
  }
  try {
    allowed.add(new URL(request.url).host);
  } catch {
    /* ignore malformed url */
  }
  if (allowed.has(originHost)) return null;
  if (wantsHtml(request)) {
    const back = request.headers.get("referer");
    if (back) {
      try {
        const dest = new URL(back);
        dest.searchParams.set("error", "bad_origin");
        return NextResponse.redirect(dest, 303);
      } catch {
        /* fall through */
      }
    }
  }
  return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
}
