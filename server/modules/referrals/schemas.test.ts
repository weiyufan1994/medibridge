import { describe, expect, it } from "vitest";
import {
  createOrderDraftInputSchema,
  setConsultationTimeInputSchema,
} from "./schemas";

describe("referral schemas", () => {
  it("accepts an idempotent platform-team referral draft", () => {
    const result = createOrderDraftInputSchema.safeParse({
      triageSessionId: 77,
      rankedHospitalIndex: 0,
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      agreementAccepted: true,
      agreementVersion: "referral_service_v2",
      agreementLang: "zh",
    });

    expect(result.success).toBe(true);
  });

  it("requires a valid client request UUID", () => {
    const result = createOrderDraftInputSchema.safeParse({
      triageSessionId: 77,
      rankedHospitalIndex: 0,
      clientRequestId: "not-an-idempotency-key",
      agreementAccepted: true,
      agreementVersion: "referral_service_v2",
      agreementLang: "en",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a complete consultation arrangement with an HTTPS joining link", () => {
    const result = setConsultationTimeInputSchema.safeParse({
      orderId: 101,
      consultationTime: new Date("2026-08-05T02:00:00.000Z"),
      timeZone: "Asia/Shanghai",
      providerName: "Dr. Zhang",
      platform: "Haodf",
      joinUrl: "https://www.haodf.com/session/example",
      instructions: "Sign in ten minutes early.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-HTTPS consultation joining links", () => {
    const result = setConsultationTimeInputSchema.safeParse({
      orderId: 101,
      consultationTime: new Date("2026-08-05T02:00:00.000Z"),
      timeZone: "Asia/Shanghai",
      providerName: "Dr. Zhang",
      platform: "Haodf",
      joinUrl: "http://www.haodf.com/session/example",
      instructions: "Sign in ten minutes early.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid consultation time zones", () => {
    const result = setConsultationTimeInputSchema.safeParse({
      orderId: 101,
      consultationTime: new Date("2026-08-05T02:00:00.000Z"),
      timeZone: "Shanghai local time",
      providerName: "Dr. Zhang",
      platform: "Haodf",
      joinUrl: "https://www.haodf.com/session/example",
      instructions: "Sign in ten minutes early.",
    });

    expect(result.success).toBe(false);
  });
});
