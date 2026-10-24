"use client";

import { applyOtpInput, otpCodeFromBoxes, otpDigitsOnly } from "@/lib/auth/otp-digits";
import { useEffect, useRef, useState } from "react";

type OtpCredentialRequest = CredentialRequestOptions & {
  otp?: { transport: Array<"sms"> };
};

/**
 * One box per digit. Paste, Persian digits, and WebOTP fill every box.
 * The first box advertises autocomplete="one-time-code" for SMS autofill.
 */
export function OtpCodeFields({
  length,
  onChange,
  onComplete,
  disabled = false,
}: {
  length: number;
  onChange: (code: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const [boxes, setBoxes] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const sent = useRef("");
  const onChangeRef = useRef(onChange);
  const onCompleteRef = useRef(onComplete);
  onChangeRef.current = onChange;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setBoxes(Array.from({ length }, () => ""));
    sent.current = "";
  }, [length]);

  useEffect(() => {
    const credentials = navigator.credentials;
    if (!credentials?.get || !("OTPCredential" in window)) return;
    const abort = new AbortController();
    const request: OtpCredentialRequest = {
      otp: { transport: ["sms"] },
      signal: abort.signal,
    };
    credentials
      .get(request)
      .then((credential) => {
        const code = credential && "code" in credential ? String(credential.code ?? "") : "";
        if (!code) return;
        const digits = otpDigitsOnly(code, length);
        if (!digits) return;
        const next = applyOtpInput(Array.from({ length }, () => ""), 0, digits);
        setBoxes(next);
        const complete = otpCodeFromBoxes(next);
        onChangeRef.current(complete || next.join(""));
        if (complete && sent.current !== complete) {
          sent.current = complete;
          onCompleteRef.current(complete);
        }
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [length]);

  const commit = (next: string[], focusIndex: number) => {
    setBoxes(next);
    const complete = otpCodeFromBoxes(next);
    onChange(complete || next.join(""));
    if (complete && sent.current !== complete) {
      sent.current = complete;
      onComplete(complete);
      return;
    }
    if (focusIndex >= 0 && focusIndex < length) refs.current[focusIndex]?.focus();
  };

  return (
    <div dir="ltr" className="flex justify-center gap-2">
      {boxes.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`رقم ${index + 1}`}
          className="h-12 w-11 rounded-xl border border-black/10 bg-[#F6F4F1] text-center text-[22px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white disabled:opacity-60"
          onChange={(event) => {
            const raw = event.target.value;
            const next = applyOtpInput(boxes, index, raw);
            const typed = otpDigitsOnly(raw, length);
            const focusAt = typed.length > 1 ? Math.min(length - 1, (typed.length >= length ? 0 : index) + typed.length) : index + 1;
            commit(next, typed.length === 0 ? index : focusAt);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!text) return;
            event.preventDefault();
            const next = applyOtpInput(boxes, index, text);
            const typed = otpDigitsOnly(text, length);
            commit(next, Math.min(length - 1, (typed.length >= length ? 0 : index) + typed.length));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              event.preventDefault();
              const next = boxes.slice();
              next[index - 1] = "";
              commit(next, index - 1);
            }
            if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              refs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowRight" && index < length - 1) {
              event.preventDefault();
              refs.current[index + 1]?.focus();
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
        />
      ))}
    </div>
  );
}
