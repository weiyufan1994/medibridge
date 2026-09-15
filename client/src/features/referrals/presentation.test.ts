import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildReferralConfirmationHref,
  buildReferralMockCheckoutHref,
  buildReferralPaymentCancelHref,
  buildReferralPaymentSuccessHref,
  buildReferralSelectionHref,
  getOrCreateReferralClientRequestId,
  getLatestReferralProgressUpdate,
  getPatientVisibleReferralTimeline,
  getReferralPaymentAction,
  getReferralOrderDetailHelperNotice,
  shouldShowReferralConsultationJoinLink,
} from "./presentation";
import { getReferralProgressUpdates } from "./progressPresentation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getReferralPaymentAction", () => {
  it("shows a pay CTA for unpaid pending orders", () => {
    expect(
      getReferralPaymentAction({
        status: "pending_payment",
        paymentStatus: "unpaid",
      })
    ).toBe("payNow");
  });

  it("shows a continue CTA for pending checkout sessions", () => {
    expect(
      getReferralPaymentAction({
        status: "pending_payment",
        paymentStatus: "pending",
      })
    ).toBe("continuePayment");
  });

  it("shows a retry CTA for failed payment attempts", () => {
    expect(
      getReferralPaymentAction({
        status: "pending_payment",
        paymentStatus: "failed",
      })
    ).toBe("retryPayment");
  });

  it("hides the CTA for paid orders", () => {
    expect(
      getReferralPaymentAction({
        status: "paid_pending_assignment",
        paymentStatus: "paid",
      })
    ).toBeNull();
  });

  it("hides the CTA for refunded and cancelled orders", () => {
    expect(
      getReferralPaymentAction({
        status: "refunded",
        paymentStatus: "refunded",
      })
    ).toBeNull();
    expect(
      getReferralPaymentAction({
        status: "cancelled",
        paymentStatus: "cancelled",
      })
    ).toBeNull();
  });
});

describe("referral mock checkout helpers", () => {
  it("builds referral mock and return routes", () => {
    expect(buildReferralMockCheckoutHref(42)).toBe(
      "/referrals/mock-checkout/42"
    );
    expect(
      buildReferralPaymentSuccessHref({
        orderId: 42,
        paymentSessionId: "cs_referral_42",
      })
    ).toBe("/referrals/payment/success?orderId=42&session_id=cs_referral_42");
    expect(
      buildReferralPaymentCancelHref({
        orderId: 42,
        paymentSessionId: "cs_referral_42",
      })
    ).toBe("/referrals/payment/cancel?orderId=42&session_id=cs_referral_42");
  });
});

describe("referral selection and idempotency helpers", () => {
  it("preserves ranked hospital and coordinator selections in referral links", () => {
    expect(
      buildReferralSelectionHref({
        triageSessionId: 77,
        rankedHospitalIndex: 2,
        hospitalId: 11,
      })
    ).toBe(
      "/referrals/select?triageSessionId=77&rankedHospitalIndex=2&hospitalId=11"
    );
    expect(
      buildReferralConfirmationHref({
        triageSessionId: 77,
        rankedHospitalIndex: 2,
        hospitalId: 11,
        contactId: 31,
      })
    ).toBe(
      "/referrals/confirm?triageSessionId=77&rankedHospitalIndex=2&hospitalId=11&contactId=31"
    );
  });

  it("reuses the same draft request id after login or a repeated click", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValue("66666666-6666-4666-8666-666666666666"),
    });
    const selection = {
      triageSessionId: 77,
      rankedHospitalIndex: 0,
      hospitalId: 11,
      contactId: 31,
    };

    expect(getOrCreateReferralClientRequestId(selection)).toBe(
      "66666666-6666-4666-8666-666666666666"
    );
    expect(getOrCreateReferralClientRequestId(selection)).toBe(
      "66666666-6666-4666-8666-666666666666"
    );
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
});

describe("getLatestReferralProgressUpdate", () => {
  it("returns fallback text when no visible operation exists", () => {
    expect(
      getLatestReferralProgressUpdate({
        operation: null,
        lang: "zh",
      })
    ).toEqual({
      text: "转诊请求正在处理中，我们会持续更新此页面。",
      updatedAt: null,
    });
  });

  it("returns patient-visible progress detail and timestamp", () => {
    const createdAt = new Date("2026-04-12T07:30:00.000Z");

    expect(
      getLatestReferralProgressUpdate({
        operation: {
          actionType: "patient_notification",
          actionPayload: {
            detail: "已与院方沟通，正在协调时间",
          },
          createdAt,
        },
        lang: "zh",
      })
    ).toEqual({
      text: "已与院方沟通，正在协调时间",
      updatedAt: createdAt,
    });
  });

  it("localizes known English system progress and includes the confirmed consultation time", () => {
    const createdAt = new Date("2026-04-12T08:30:00.000Z");
    const consultationTime = "2026-04-13T09:00:00.000Z";

    const result = getLatestReferralProgressUpdate({
      operation: {
        actionType: "patient_notification",
        actionPayload: {
          detail: "Consultation time confirmed.",
        },
        createdAt,
      },
      lang: "zh",
      consultationTime,
    });

    expect(result.updatedAt).toBe(createdAt);
    expect(result.text).toContain("问诊时间已确认");
    expect(result.text).not.toContain("Consultation time confirmed");
  });

  it("localizes known English payment progress text for patient view", () => {
    expect(
      getLatestReferralProgressUpdate({
        operation: {
          actionType: "patient_notification",
          actionPayload: {
            detail:
              "Payment received. Your referral request is now waiting for internal assignment.",
          },
          createdAt: new Date("2026-04-12T08:30:00.000Z"),
        },
        lang: "zh",
      }).text
    ).toBe("已收到支付，订单正在等待平台内部接单处理。");
  });
});

describe("getReferralProgressUpdates", () => {
  it("does not rewrite an earlier confirmation with the current consultation time", () => {
    const result = getReferralProgressUpdates({
      operations: [
        {
          id: 12,
          actionType: "patient_notification",
          actionPayload: { detail: "Consultation time confirmed." },
          createdAt: new Date("2026-04-12T08:30:00.000Z"),
        },
        {
          id: 11,
          actionType: "patient_notification",
          actionPayload: { detail: "Consultation time confirmed." },
          createdAt: new Date("2026-04-12T08:00:00.000Z"),
        },
      ],
      lang: "zh",
      consultationTime: "2026-04-13T09:00:00.000Z",
    });

    expect(result[0].text).toContain("问诊时间已确认:");
    expect(result[1].text).toBe("问诊时间已确认。");
  });

  it("preserves the consultation time stored on an earlier scheduling event", () => {
    const originalConsultationTime = "2026-04-13T09:00:00.000Z";
    const originalOperation = {
      id: 11,
      actionType: "consultation_time_confirmed",
      actionPayload: { consultationTime: originalConsultationTime },
      createdAt: new Date("2026-04-12T08:00:00.000Z"),
    };
    const result = getReferralProgressUpdates({
      operations: [
        {
          id: 12,
          actionType: "patient_notification",
          actionPayload: { detail: "Consultation time confirmed." },
          createdAt: new Date("2026-04-12T08:30:00.000Z"),
        },
        originalOperation,
      ],
      lang: "en",
      consultationTime: "2026-04-14T09:00:00.000Z",
    });

    expect(result[1]).toEqual({
      id: originalOperation.id,
      ...getLatestReferralProgressUpdate({
        operation: originalOperation,
        lang: "en",
      }),
    });
    expect(result[1].text).not.toBe(result[0].text);
  });

  it("keeps an earlier patient-visible update after a later scheduling event", () => {
    const result = getReferralProgressUpdates({
      operations: [
        {
          id: 12,
          actionType: "patient_notification",
          actionPayload: { detail: "Consultation time confirmed." },
          createdAt: new Date("2026-04-12T08:30:00.000Z"),
        },
        {
          id: 11,
          actionType: "patient_notification",
          actionPayload: { detail: "已提交资料，正在等待院方确认" },
          createdAt: new Date("2026-04-12T08:00:00.000Z"),
        },
      ],
      lang: "zh",
      consultationTime: "2026-04-13T09:00:00.000Z",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 12,
      text: expect.stringContaining("问诊时间已确认"),
    });
    expect(result[1]).toEqual({
      id: 11,
      text: "已提交资料，正在等待院方确认",
      updatedAt: new Date("2026-04-12T08:00:00.000Z"),
    });
  });
});

describe("getReferralOrderDetailHelperNotice", () => {
  it("shows the manual coordination notice only while manual fulfillment is still in progress", () => {
    expect(
      getReferralOrderDetailHelperNotice({
        status: "contacting",
        manualFulfillmentRequired: true,
        consultationTime: null,
        lang: "zh",
      })
    ).toEqual({
      tone: "warning",
      text: "该订单当前由平台人工协调推进，团队正在继续联系医院或医生安排后续流程。",
    });
  });

  it("shows a confirmed consultation notice instead of the manual notice once time is confirmed", () => {
    expect(
      getReferralOrderDetailHelperNotice({
        status: "scheduled",
        manualFulfillmentRequired: true,
        consultationTime: "2026-04-13T09:00:00.000Z",
        lang: "zh",
      })
    ).toEqual({
      tone: "success",
      text: "问诊时间已确认，请按下方显示时间准时参加；如时间有变动，我们会及时通知你。",
    });
  });
});

describe("shouldShowReferralConsultationJoinLink", () => {
  it("shows the join link while the consultation is scheduled", () => {
    expect(shouldShowReferralConsultationJoinLink("scheduled")).toBe(true);
  });

  it.each(["completed", "refund_pending_review", "cancelled"] as const)(
    "hides the join link when the order is %s",
    status => {
      expect(shouldShowReferralConsultationJoinLink(status)).toBe(false);
    }
  );
});

describe("getPatientVisibleReferralTimeline", () => {
  it("collapses consecutive duplicate status entries for patient display", () => {
    expect(
      getPatientVisibleReferralTimeline([
        { id: 3, toStatus: "pending_payment" as const },
        { id: 2, toStatus: "pending_payment" as const },
        { id: 1, toStatus: "paid_pending_assignment" as const },
      ])
    ).toEqual([
      { id: 3, toStatus: "pending_payment" },
      { id: 1, toStatus: "paid_pending_assignment" },
    ]);
  });
});
