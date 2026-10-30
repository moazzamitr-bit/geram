/** Pure helpers for the active-sessions page (no secrets, testable). */
export type DeviceInfo = { label: string; kind: "mobile" | "tablet" | "desktop" };

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  if (!s) return { label: "دستگاه ناشناس", kind: "desktop" };
  let device = "رایانه";
  let kind: DeviceInfo["kind"] = "desktop";
  if (/iPhone/i.test(s)) { device = "آیفون"; kind = "mobile"; }
  else if (/iPad/i.test(s)) { device = "آیپد"; kind = "tablet"; }
  else if (/Android/i.test(s)) { device = /Mobile/i.test(s) ? "گوشی اندروید" : "تبلت اندروید"; kind = /Mobile/i.test(s) ? "mobile" : "tablet"; }
  else if (/Windows/i.test(s)) device = "ویندوز";
  else if (/Macintosh|Mac OS X/i.test(s)) device = "مک";
  else if (/Linux/i.test(s)) device = "لینوکس";
  let browser = "مرورگر";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/CriOS|Chrome\//.test(s)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = "Safari";
  else if (/iPhone|iPad/.test(s) && /AppleWebKit/.test(s)) browser = "اپ نصب‌شده";
  else if (/node|curl|undici|supabase|gotrue/i.test(s)) browser = "اسکریپت";
  return { label: `${device} · ${browser}`, kind };
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) return `${v4[1]}.${v4[2]}.*.*`;
  if (ip.includes(":")) return ip.split(":").slice(0, 2).join(":") + ":…";
  return "—";
}

export function sessionIdFromJwt(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof json.session_id === "string" ? json.session_id : null;
  } catch { return null; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function relativeFa(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((now - t) / 1000));
  const fa = (n: number) => n.toLocaleString("fa-IR");
  if (sec < 60) return "همین الان";
  if (sec < 3600) return `${fa(Math.floor(sec / 60))} دقیقه پیش`;
  if (sec < 86400) return `${fa(Math.floor(sec / 3600))} ساعت پیش`;
  if (sec < 86400 * 30) return `${fa(Math.floor(sec / 86400))} روز پیش`;
  return new Date(t).toLocaleDateString("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran" });
}
