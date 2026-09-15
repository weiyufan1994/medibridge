import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { inferRouterOutputs } from "@trpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AppRouter } from "../../../../../server/routers";
import { getReferralCopy } from "../copy";
import { ReferralOrderDetailScreen } from "./ReferralOrderDetailScreen";

type OrderDetail = inferRouterOutputs<AppRouter>["referrals"]["getOrderDetail"];

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    referrals: {
      getOrderDetail: { useQuery: mocks.useQuery },
      createPaymentSession: { useMutation: mocks.useMutation },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/referrals/orders/101", mocks.setLocation],
}));

const testGlobal = globalThis as typeof globalThis & {
  React?: typeof React;
};
const previousReact = testGlobal.React;

beforeAll(() => {
  testGlobal.React = React;
});

afterAll(() => {
  if (previousReact) {
    testGlobal.React = previousReact;
    return;
  }

  Reflect.deleteProperty(testGlobal, "React");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useMutation.mockReturnValue({
    isPending: false,
    mutateAsync: mocks.mutateAsync,
  });
});

function createDetail(status: "scheduled" | "completed"): OrderDetail {
  const consultationTime = new Date("2026-04-13T09:00:00.000Z");
  const updatedAt = new Date("2026-04-12T08:30:00.000Z");

  return {
    order: {
      id: 101,
      status,
      paymentStatus: "paid",
      manualFulfillmentRequired: true,
      totalAmount: 50000,
      currency: "USD",
      createdAt: new Date("2026-04-11T08:00:00.000Z"),
      updatedAt,
      paidAt: new Date("2026-04-11T08:05:00.000Z"),
      fulfillmentDeadlineAt: new Date("2026-04-14T08:05:00.000Z"),
      triageSessionId: 77,
      consultationTime,
      assignedAgentId: 901,
      agreementAcceptedAt: new Date("2026-04-11T08:00:00.000Z"),
      agreementVersion: "v1",
      agreementLang: "en",
      refundReason: null,
      completedAt: status === "completed" ? consultationTime : null,
      refundedAt: null,
    },
    triageSummary: "Patient requested a specialist consultation.",
    recommendationReason: "Matched specialty",
    hospital: {
      id: 1,
      name: { zh: "示例医院", en: "Example Hospital" },
      city: { zh: "上海", en: "Shanghai" },
      level: { zh: "三级", en: "Tertiary" },
      imageUrl: null,
      isLocalCatalogMatch: true,
    },
    department: {
      id: 2,
      name: { zh: "心内科", en: "Cardiology" },
      isLocalCatalogMatch: true,
    },
    contact: null,
    consultationArrangement: {
      scheduledAt: consultationTime,
      timeZone: "Asia/Shanghai",
      providerName: "Dr Zhang",
      platform: "Example Video",
      joinUrl: "https://video.example.test/patient-consultation",
      instructions: "Join ten minutes before the appointment.",
    },
    timeline: [
      {
        id: 31,
        fromStatus: "time_coordination",
        toStatus: "scheduled",
        actorType: "ops",
        actorId: 901,
        reason: "consultation_time_confirmed",
        createdAt: updatedAt,
      },
    ],
    operations: [
      {
        id: 12,
        actionType: "patient_notification",
        operatorType: "ops",
        operatorId: 901,
        actionPayload: { detail: "Hospital confirmed the appointment." },
        createdAt: updatedAt,
      },
      {
        id: 11,
        actionType: "patient_notification",
        operatorType: "ops",
        operatorId: 901,
        actionPayload: { detail: "Hospital paperwork submitted." },
        createdAt: new Date("2026-04-12T08:00:00.000Z"),
      },
    ],
    refundRequest: null,
  };
}

function renderScreen(input: {
  detail?: OrderDetail;
  lang?: "zh" | "en";
  isFetching?: boolean;
}) {
  mocks.useQuery.mockReturnValue({
    data: input.detail ?? createDetail("scheduled"),
    isLoading: false,
    isFetching: input.isFetching ?? false,
    error: null,
    refetch: mocks.refetch,
  });

  return renderToStaticMarkup(
    React.createElement(ReferralOrderDetailScreen, {
      orderId: 101,
      lang: input.lang ?? "en",
    })
  );
}

describe("ReferralOrderDetailScreen", () => {
  it("offers the actual consultation link for a scheduled order", () => {
    const detail = createDetail("scheduled");
    const markup = renderScreen({ detail, lang: "zh" });

    expect(markup).toContain(
      `href="${detail.consultationArrangement?.joinUrl}"`
    );
    expect(markup).toContain(
      getReferralCopy("zh").orderDetail.consultationJoinLink
    );
    expect(markup).toContain("示例医院");
    expect(markup).toContain("心内科");
  });

  it("keeps the consultation record while hiding its join link after completion", () => {
    const detail = createDetail("completed");
    const markup = renderScreen({ detail });

    expect(markup).not.toContain(detail.consultationArrangement?.joinUrl);
    expect(markup).not.toContain(
      getReferralCopy("en").orderDetail.consultationJoinLink
    );
    expect(markup).toContain("Dr Zhang");
    expect(markup).toContain("Example Video");
    expect(markup).toContain("Join ten minutes before the appointment.");
    expect(markup).toContain(getReferralCopy("en").statusLabels.completed);
  });

  it("shows the newest public note before its earlier history", () => {
    const markup = renderScreen({});
    const latestNoteIndex = markup.indexOf(
      "Hospital confirmed the appointment."
    );
    const historyTitleIndex = markup.indexOf("Previous updates");
    const earlierNoteIndex = markup.indexOf("Hospital paperwork submitted.");

    expect(latestNoteIndex).toBeGreaterThan(-1);
    expect(historyTitleIndex).toBeGreaterThan(latestNoteIndex);
    expect(earlierNoteIndex).toBeGreaterThan(historyTitleIndex);
    expect(markup.match(/Updated:/g)).toHaveLength(2);
  });

  it("shows the localized progress fallback without an empty history section", () => {
    const detail = { ...createDetail("scheduled"), operations: [] };
    const copy = getReferralCopy("zh");
    const markup = renderScreen({ detail, lang: "zh" });

    expect(markup).toContain(copy.orderDetail.latestUpdateFallback);
    expect(markup).not.toContain(copy.orderDetail.previousUpdates);
  });

  it.each([false, true])(
    "makes manual refresh available only when a fetch is not running (fetching=%s)",
    isFetching => {
      const markup = renderScreen({ isFetching });
      const refreshButton = markup.match(
        /<button\b[^>]*>Refresh<\/button>/
      )?.[0];

      expect(refreshButton).toBeDefined();
      expect(refreshButton?.includes('disabled=""')).toBe(isFetching);
    }
  );
});
