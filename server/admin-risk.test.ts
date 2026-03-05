import { describe, expect, it } from "vitest";
import {
  computeAdminRisks,
  computeAdminSuggestions,
} from "../client/src/features/admin/risk";

describe("computeAdminRisks", () => {
  it("returns pending payment timeout warning", () => {
    const now = new Date("2026-03-05T10:30:00.000Z");
    const risks = computeAdminRisks(
      {
        appointment: {
          status: "pending_payment",
          paymentStatus: "pending",
          createdAt: "2026-03-05T09:00:00.000Z",
        },
      },
      now
    );

    expect(risks.some(item => item.code === "PENDING_PAYMENT_TIMEOUT")).toBe(true);
  });

  it("returns webhook failure critical risk", () => {
    const risks = computeAdminRisks({
      appointment: {
        status: "paid",
        paymentStatus: "paid",
      },
      webhookEvents: [{ type: "processing_error" }],
    });

    expect(risks.some(item => item.code === "WEBHOOK_FAILURE")).toBe(true);
  });

  it("returns token expiring warning", () => {
    const now = new Date("2026-03-05T10:00:00.000Z");
    const risks = computeAdminRisks(
      {
        appointment: {
          status: "active",
          paymentStatus: "paid",
        },
        activeTokens: [
          {
            role: "patient",
            expiresAt: "2026-03-05T11:00:00.000Z",
            useCount: 0,
            maxUses: 1,
          },
        ],
      },
      now
    );

    expect(risks.some(item => item.code === "TOKEN_EXPIRING_SOON")).toBe(true);
  });

  it("suggests reinitiate payment on pending timeout", () => {
    const now = new Date("2026-03-05T10:30:00.000Z");
    const detail = {
      appointment: {
        status: "pending_payment",
        paymentStatus: "pending",
        createdAt: "2026-03-05T09:00:00.000Z",
      },
    };
    const risks = computeAdminRisks(detail, now);
    const suggestions = computeAdminSuggestions(detail, risks);

    expect(suggestions[0]?.action).toBe("reinitiate_payment");
  });

  it("suggests access-link actions for paid appointments", () => {
    const detail = {
      appointment: {
        status: "active",
        paymentStatus: "paid",
      },
      activeTokens: [],
    };
    const risks = computeAdminRisks(detail);
    const suggestions = computeAdminSuggestions(detail, risks);

    expect(suggestions.some(item => item.action === "resend_access_link")).toBe(true);
    expect(suggestions.some(item => item.action === "issue_access_links")).toBe(true);
  });
});
