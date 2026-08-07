import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFaNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("fa-IR", options).format(value);
}

export function formatToman(value: number) {
  return `${formatFaNumber(value)} تومان`;
}
