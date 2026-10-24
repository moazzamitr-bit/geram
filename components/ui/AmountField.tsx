"use client";

import { editAmount, formatAmountValue, tomanInWords, type AmountDigits } from "@/lib/format/amount";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type AmountFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: number;
  onValueChange: (value: number) => void;
  decimals?: number;
  digits?: AmountDigits;
  words?: boolean;
  wordsClassName?: string;
  wrapperClassName?: string;
};

export function AmountField({
  value,
  onValueChange,
  decimals = 0,
  digits = "fa",
  words = false,
  wordsClassName,
  wrapperClassName,
  className,
  onFocus,
  onBlur,
  placeholder = "۰",
  ...rest
}: AmountFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => formatAmountValue(value, { decimals, digits }));

  useEffect(() => {
    if (focused) return;
    setText(formatAmountValue(value, { decimals, digits }));
  }, [value, focused, decimals, digits]);

  const phrase = words ? tomanInWords(value) : "";

  return (
    <div className={cn("min-w-0", wrapperClassName)}>
      <input
        {...rest}
        ref={inputRef}
        dir="ltr"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete={rest.autoComplete ?? "off"}
        placeholder={placeholder}
        value={text}
        className={className}
        onFocus={(event) => {
          setFocused(true);
          if (value === 0) {
            requestAnimationFrame(() => event.currentTarget.select());
          }
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          setText(formatAmountValue(value, { decimals, digits }));
          onBlur?.(event);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          const next = editAmount(raw, caret, { decimals, digits });
          setText(next.text);
          onValueChange(next.value);
          const node = event.target;
          requestAnimationFrame(() => {
            node.setSelectionRange(next.caret, next.caret);
          });
        }}
      />
      {phrase ? (
        <p className={wordsClassName ?? "mt-1 text-[12px] text-muted-app"}>{phrase}</p>
      ) : null}
    </div>
  );
}
