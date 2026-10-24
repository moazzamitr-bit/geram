import { describe, expect, it } from "vitest";
import { applyOtpInput, otpCodeFromBoxes, otpDigitsOnly } from "@/lib/auth/otp-digits";

const empty = ["", "", "", "", ""];

describe("otp digit boxes", () => {
  it("turns Persian and Arabic digits into ASCII and drops other characters", () => {
    expect(otpDigitsOnly("کد: ۱۲۳۴۵", 5)).toBe("12345");
    expect(otpDigitsOnly("١٢٣٤٥", 5)).toBe("12345");
    expect(otpDigitsOnly("12-3459", 5)).toBe("12345");
  });

  it("distributes a full paste into any box", () => {
    expect(applyOtpInput(empty, 0, "12345").join("")).toBe("12345");
    expect(applyOtpInput(empty, 4, "۱۲۳۴۵").join("")).toBe("12345");
    expect(applyOtpInput(["9", "", "", "", ""], 2, "12345").join("")).toBe("12345");
  });

  it("types one digit into the focused box and keeps a short paste local", () => {
    expect(applyOtpInput(empty, 1, "۵")).toEqual(["", "5", "", "", ""]);
    expect(applyOtpInput(empty, 3, "89")).toEqual(["", "", "", "8", "9"]);
  });

  it("is complete only when every box has one digit", () => {
    expect(otpCodeFromBoxes(["1", "2", "3", "4", ""])).toBe("");
    expect(otpCodeFromBoxes(["1", "2", "3", "4", "5"])).toBe("12345");
  });
});
