"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["حباب سکه یعنی چه؟", "قیمت الان طلای ۱۸ عیار چند است؟", "تحویل فیزیکی چطور انجام می‌شود؟", "خرید پله‌ای چیست؟"];

export function AssistantWidget() {
  const [enabled, setEnabled] = useState(false);
  const [disclaimer, setDisclaimer] = useState("");
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d?.enabled === true);
        setDisclaimer(d?.disclaimer ?? "");
      })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  if (!enabled || typeof document === "undefined") return null;

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    setError("");
    setText("");
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok && d.reply) setMsgs((m) => [...m, { role: "assistant", content: d.reply }]);
      else setError(d?.message || "دستیار در حال حاضر در دسترس نیست.");
    } catch {
      setError("اتصال برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="geram-app" dir="rtl">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="دستیار گرم"
          className="geram-assistant-fab fixed left-4 z-40 flex h-12 items-center gap-2 rounded-full bg-[#1C1917] px-4 text-[13px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(28,25,23,0.6)]"
        >
          <MessageCircle size={18} /> دستیار گرم
        </button>
      ) : (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:items-end lg:justify-start lg:bg-transparent lg:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="دستیار گرم"
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#FAF8F5] pb-[env(safe-area-inset-bottom)] shadow-2xl lg:h-[600px] lg:w-[400px] lg:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <p className="text-[15px] font-bold text-[#1C1917]">دستیار گرم</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="grid h-9 w-9 place-items-center rounded-full text-[#1C1917] hover:bg-black/5">
                <X size={18} />
              </button>
            </div>
            <p className="mx-4 mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-[12px] leading-6 text-[#5C4100]">{disclaimer}</p>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {msgs.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#44403C]">سلام! درباره قیمت لحظه‌ای، مفاهیم بازار طلا یا نحوه کار با گرم بپرسید.</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#1C1917]">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#1C1917] px-3 py-2 text-[14px] leading-7 text-white"
                      : "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white px-3 py-2 text-[14px] leading-7 text-[#1C1917] shadow-sm"
                  }
                >
                  {m.content}
                </div>
              ))}
              {busy ? <p className="text-[13px] text-[#57534E]">در حال پاسخ…</p> : null}
              {error ? <p className="text-[13px] text-[#B42318]">{error}</p> : null}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
              className="flex items-center gap-2 border-t border-black/[0.06] p-3"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={600}
                placeholder="سؤال خود را بنویسید…"
                className="h-11 flex-1 rounded-full border border-black/10 bg-white px-4 text-[16px] text-[#1C1917] placeholder:text-[#78716C] focus:outline-none"
              />
              <button type="submit" disabled={busy || !text.trim()} aria-label="ارسال" className="grid h-11 w-11 place-items-center rounded-full bg-[#1C1917] text-white disabled:opacity-40">
                <Send size={18} className="-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
