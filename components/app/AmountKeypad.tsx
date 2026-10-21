"use client";

import { cn } from "@/lib/utils";
import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"] as const;
const MAX_DIGITS = 13;

/**
 * Phone-style amount keypad (Wallgold-style): big targets, no system keyboard
 * covering the quote. Integer toman amounts only.
 */
export function AmountKeypad({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  const press = (key: (typeof KEYS)[number]) => {
    const digits = value > 0 ? String(value) : "";
    if (key === "del") {
      onChange(Number(digits.slice(0, -1) || 0));
      return;
    }
    const next = (digits + key).replace(/^0+/, "");
    if (next.length > MAX_DIGITS) return;
    onChange(Number(next || 0));
  };

  return (
    <div className={cn("grid grid-cols-3 gap-1", className)} dir="ltr">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          aria-label={key === "del" ? "پاک کردن" : key}
          className="flex h-12 items-center justify-center rounded-xl text-[20px] font-bold text-text transition-colors active:bg-white/[0.08] hover:bg-white/[0.04]"
        >
          {key === "del" ? (
            <Delete size={20} strokeWidth={1.7} className="text-muted-app" />
          ) : (
            Number(key).toLocaleString("fa-IR", { minimumIntegerDigits: key.length, useGrouping: false })
          )}
        </button>
      ))}
    </div>
  );
}
