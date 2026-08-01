import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  enqueueReferralNotification: vi.fn(),
  getReferralOrderBundleById: vi.fn(),
}));

import * as referralRepo from "./repo";
import {
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./notifications";

describe("referral notification outbox", () => {
  const originalOpsEmails = process.env.REFERRAL_OPS_EMAILS;
  const originalBaseUrl = process.env.APP_BASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "https://app.medibridge.test";
  });

  afterEach(() => {
    process.env.REFERRAL_OPS_EMAILS = originalOpsEmails;
    process.env.APP_BASE_URL = originalBaseUrl;
  });

  it("queues a Chinese patient email without including the medical summary", async () => {
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue({
      order: {
        agreementLang: "zh",
        caseSummarySnapshot: "Sensitive medical narrative",
      },
      patient: {
        email: "patient@example.com",
      },
    } as never);

    await notifyPatientReferralUpdate({
      orderId: 901,
      event: "payment_success",
      detail: "Payment received.",
    });

    expect(referralRepo.enqueueReferralNotification).toHaveBeenCalledTimes(1);
    const call = vi.mocked(referralRepo.enqueueReferralNotification).mock
      .calls[0]?.[0];
    expect(call?.values.language).toBe("zh");
    expect(call?.values.recipient).toBe("patient@example.com");
    expect(JSON.stringify(call?.values.payload)).toContain("已收到服务费");
    expect(JSON.stringify(call?.values.payload)).not.toContain(
      "Sensitive medical narrative"
    );
    expect(JSON.stringify(call?.values.payload)).not.toContain(
      "/session/example"
    );

    vi.mocked(referralRepo.enqueueReferralNotification).mockClear();
    await notifyPatientReferralUpdate({
      orderId: 901,
      event: "patient_progress_update",
      detail: "Sensitive medical narrative",
    });
    const progressCall = vi.mocked(referralRepo.enqueueReferralNotification)
      .mock.calls[0]?.[0];
    expect(JSON.stringify(progressCall?.values.payload)).toContain(
      "订单有新的重要进展"
    );
    expect(JSON.stringify(progressCall?.values.payload)).not.toContain(
      "Sensitive medical narrative"
    );
  });

  it("queues one deduplicated operations email per configured recipient", async () => {
    process.env.REFERRAL_OPS_EMAILS =
      "Ops1@example.com, ops2@example.com,ops1@example.com";

    await notifyInternalPaidReferralOrder({
      orderId: 902,
      hospitalName: "Zhongshan Hospital",
      contactName: null,
      manualFulfillmentRequired: true,
    });

    const recipients = vi
      .mocked(referralRepo.enqueueReferralNotification)
      .mock.calls.map(([call]) => call.values.recipient);
    expect(recipients).toEqual(["ops1@example.com", "ops2@example.com"]);
    const dedupeKeys = vi
      .mocked(referralRepo.enqueueReferralNotification)
      .mock.calls.map(([call]) => call.values.dedupeKey);
    expect(new Set(dedupeKeys).size).toBe(2);
  });
});
