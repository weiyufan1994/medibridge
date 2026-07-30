import { describe, expect, it } from "vitest";
import {
  formatBookingAmount,
  formatBookingDate,
  getBatchResultTone,
  getBookingEmailSummary,
  getBookingRiskAccent,
  getBookingStatusDotClass,
} from "@/features/booking/presentation";

describe("booking presentation helpers", () => {
  it("formats amount using locale and currency", () => {
    expect(formatBookingAmount(12345, "USD", "en-US")).toBe("$123.45");
  });

  it("returns placeholder for invalid dates", () => {
    expect(formatBookingDate(null, "en-US")).toBe("-");
    expect(formatBookingDate("bad-date", "en-US")).toBe("-");
  });

  it("maps status and batch result tones", () => {
    expect(getBookingStatusDotClass("completed")).toBe("bg-emerald-500");
    expect(getBatchResultTone("failed")).toBe("text-rose-700");
  });

  it("shortens long emails for dense rows", () => {
    expect(getBookingEmailSummary("averylongpatientalias@example.com")).toBe(
      "averylongp...@example.com"
    );
  });

  it("returns stronger alert accent for critical risk codes", () => {
    expect(
      getBookingRiskAccent({
        riskFlag: true,
        riskCodes: ["WEBHOOK_FAILURE"],
      })
    ).toEqual({
      iconClassName: "text-rose-600",
      dotClassName: "bg-rose-500",
    });
  });
});
