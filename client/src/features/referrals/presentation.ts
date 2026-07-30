import type { ReferralLang } from "@/features/referrals/copy";
import { getReferralCopy } from "@/features/referrals/copy";
import { getDisplayLocale } from "@/lib/i18n";
import type {
  RefundRequestStatus,
  ReferralPaymentStatus,
  ReferralOrderStatus,
} from "@shared/referrals";
import { getReferralPaymentActionForOrder } from "@shared/referrals";

const REFERRAL_MOCK_CHECKOUT_ENABLED_VALUE = "1";

type ReferralOperationLike = {
  actionType: string;
  actionPayload: unknown;
  createdAt: Date | string;
};

type ReferralTimelineEventLike = {
  toStatus: ReferralOrderStatus;
};

const SYSTEM_PROGRESS_DETAIL_KEYS = {
  paymentReceived: new Set([
    "Payment received. Your referral request is now waiting for internal assignment.",
    "Payment received",
  ]),
  consultationTimeConfirmed: new Set([
    "Consultation time has been confirmed.",
    "Consultation time confirmed.",
    "Consultation time confirmed",
  ]),
  refundReviewInProgress: new Set([
    "A refund review is in progress for your referral order.",
  ]),
  refundReviewInitiated: new Set(["Refund review initiated."]),
  refundCompleted: new Set(["Refund completed."]),
} as const;

const MANUAL_FULFILLMENT_NOTICE_STATUSES = new Set<ReferralOrderStatus>([
  "paid_pending_assignment",
  "assigned",
  "contacting",
  "booking_in_progress",
  "time_coordination",
]);

export function getReferralStatusLabel(
  status: ReferralOrderStatus,
  lang: ReferralLang
) {
  return getReferralCopy(lang).statusLabels[status];
}

export function getRefundStatusLabel(
  status: RefundRequestStatus,
  lang: ReferralLang
) {
  return getReferralCopy(lang).refundStatusLabels[status];
}

export function getReferralOperationLabel(
  actionType: string,
  lang: ReferralLang
) {
  const labels = getReferralCopy(lang).operationLabels;

  if (actionType in labels) {
    return labels[actionType as keyof typeof labels];
  }

  return getReferralCopy(lang).common.unknown;
}

export function getLatestReferralProgressUpdate(input: {
  operation: ReferralOperationLike | null;
  lang: ReferralLang;
  consultationTime?: Date | string | null;
}) {
  const copy = getReferralCopy(input.lang);

  if (!input.operation) {
    return {
      text: copy.orderDetail.latestUpdateFallback,
      updatedAt: null,
    };
  }

  const payload =
    input.operation.actionPayload &&
    typeof input.operation.actionPayload === "object"
      ? (input.operation.actionPayload as Record<string, unknown>)
      : null;

  if (
    input.operation.actionType === "patient_notification" &&
    typeof payload?.detail === "string" &&
    payload.detail.trim().length > 0
  ) {
    if (
      isConsultationConfirmedProgressDetail(payload.detail) &&
      input.consultationTime
    ) {
      return {
        text: `${copy.operationLabels.consultation_time_confirmed}: ${formatReferralDateTime(
          input.consultationTime,
          input.lang
        )}`,
        updatedAt: input.operation.createdAt,
      };
    }

    return {
      text: localizeReferralProgressDetail({
        detail: payload.detail,
        lang: input.lang,
      }),
      updatedAt: input.operation.createdAt,
    };
  }

  if (
    (input.operation.actionType === "consultation_time_confirmed" ||
      input.operation.actionType === "consultation_time_updated") &&
    typeof payload?.consultationTime === "string"
  ) {
    return {
      text: `${getReferralOperationLabel(
        input.operation.actionType,
        input.lang
      )}: ${formatReferralDateTime(payload.consultationTime, input.lang)}`,
      updatedAt: input.operation.createdAt,
    };
  }

  return {
    text: getReferralOperationLabel(input.operation.actionType, input.lang),
    updatedAt: input.operation.createdAt,
  };
}

export function getReferralOrderDetailHelperNotice(input: {
  status: ReferralOrderStatus;
  manualFulfillmentRequired: boolean;
  consultationTime?: Date | string | null;
  lang: ReferralLang;
}) {
  const copy = getReferralCopy(input.lang);

  if (
    input.consultationTime ||
    input.status === "scheduled" ||
    input.status === "completed"
  ) {
    return {
      tone: "success" as const,
      text: copy.orderDetail.consultationConfirmedNotice,
    };
  }

  if (
    input.manualFulfillmentRequired &&
    MANUAL_FULFILLMENT_NOTICE_STATUSES.has(input.status)
  ) {
    return {
      tone: "warning" as const,
      text: copy.orderDetail.manualFulfillmentNotice,
    };
  }

  return null;
}

export function getPatientVisibleReferralTimeline<T extends ReferralTimelineEventLike>(
  timeline: readonly T[]
) {
  return timeline.filter((event, index) => {
    if (index === 0) {
      return true;
    }

    return event.toStatus !== timeline[index - 1]?.toStatus;
  });
}

export function formatReferralMoney(input: {
  amount: number;
  currency: string;
  lang: ReferralLang;
}) {
  return new Intl.NumberFormat(getDisplayLocale(input.lang), {
    style: "currency",
    currency: input.currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(input.amount / 100);
}

export function formatReferralDateTime(
  value: Date | string | null | undefined,
  lang: ReferralLang,
  timeZone?: string
) {
  if (!value) {
    return getReferralCopy(lang).common.notAvailable;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return getReferralCopy(lang).common.notAvailable;
  }

  return date.toLocaleString(
    getDisplayLocale(lang),
    timeZone ? { timeZone } : undefined
  );
}

export function getReferralPaymentAction(input: {
  status: ReferralOrderStatus;
  paymentStatus: ReferralPaymentStatus;
}) {
  return getReferralPaymentActionForOrder(input);
}

export function getReferralUserErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      message.length > 0 &&
      !/^request failed with status code \d+$/i.test(message)
    ) {
      return message;
    }
  }

  return fallbackMessage;
}

export function shouldUseReferralMockCheckout(input: {
  isDevelopment: boolean;
  flagValue: string | boolean | null | undefined;
}) {
  return (
    input.isDevelopment &&
    String(input.flagValue ?? "").trim() === REFERRAL_MOCK_CHECKOUT_ENABLED_VALUE
  );
}

function buildHref(
  pathname: string,
  params: Record<string, string | number | null | undefined>
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || typeof value === "undefined") {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildReferralSelectionHref(input: {
  triageSessionId: number;
  rankedHospitalIndex?: number;
  hospitalId?: number;
}) {
  return buildHref("/referrals/select", input);
}

export function buildReferralConfirmationHref(input: {
  triageSessionId: number;
  rankedHospitalIndex?: number;
  hospitalId?: number;
  contactId?: number;
}) {
  return buildHref("/referrals/confirm", input);
}

export function buildReferralPaymentHref(orderId: number) {
  return buildHref("/referrals/pay", { orderId });
}

export function buildReferralMockCheckoutHref(orderId: number) {
  return `/referrals/mock-checkout/${orderId}`;
}

export function buildReferralPaymentSuccessHref(input: {
  orderId: number;
  paymentSessionId?: string | null;
}) {
  return buildHref("/referrals/payment/success", {
    orderId: input.orderId,
    session_id: input.paymentSessionId ?? null,
  });
}

export function buildReferralPaymentCancelHref(input: {
  orderId: number;
  paymentSessionId?: string | null;
}) {
  return buildHref("/referrals/payment/cancel", {
    orderId: input.orderId,
    session_id: input.paymentSessionId ?? null,
  });
}

export function buildReferralOrderHref(orderId: number) {
  return `/referrals/orders/${orderId}`;
}

export function buildReferralOrdersListHref() {
  // Referral orders currently live in the dashboard appointments section.
  return "/dashboard?section=appointments";
}

export function getOrCreateReferralClientRequestId(input: {
  triageSessionId: number;
  rankedHospitalIndex?: number;
  hospitalId?: number;
  contactId?: number;
}) {
  const storageKey = `medibridge:referral-draft:${JSON.stringify(input)}`;
  const existing =
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(storageKey);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existing
    )
  ) {
    return existing;
  }

  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, character =>
          (
            Number(character) ^
            (Math.random() * 16) >>
              (Number(character) / 4)
          ).toString(16)
        );

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(storageKey, requestId);
  }
  return requestId;
}

export function isReferralMockCheckoutEnabled() {
  return shouldUseReferralMockCheckout({
    isDevelopment: import.meta.env.DEV,
    flagValue: import.meta.env.VITE_REFERRAL_MOCK_CHECKOUT,
  });
}

export function getReferralCheckoutRedirectHref(input: {
  orderId: number;
  checkoutSessionUrl: string;
}) {
  return isReferralMockCheckoutEnabled()
    ? buildReferralMockCheckoutHref(input.orderId)
    : input.checkoutSessionUrl;
}

export function parsePositiveNumberParam(value: string | null | undefined) {
  const parsed = Number(value ?? NaN);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeNumberParam(value: string | null | undefined) {
  const parsed = Number(value ?? NaN);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isConsultationConfirmedProgressDetail(detail: string) {
  return SYSTEM_PROGRESS_DETAIL_KEYS.consultationTimeConfirmed.has(detail.trim());
}

function localizeReferralProgressDetail(input: {
  detail: string;
  lang: ReferralLang;
}) {
  const detail = input.detail.trim();
  const copy = getReferralCopy(input.lang);

  if (SYSTEM_PROGRESS_DETAIL_KEYS.paymentReceived.has(detail)) {
    return copy.orderDetail.systemProgress.paymentReceived;
  }

  if (SYSTEM_PROGRESS_DETAIL_KEYS.consultationTimeConfirmed.has(detail)) {
    return copy.orderDetail.systemProgress.consultationTimeConfirmed;
  }

  if (SYSTEM_PROGRESS_DETAIL_KEYS.refundReviewInProgress.has(detail)) {
    return copy.orderDetail.systemProgress.refundReviewInProgress;
  }

  if (SYSTEM_PROGRESS_DETAIL_KEYS.refundReviewInitiated.has(detail)) {
    return copy.orderDetail.systemProgress.refundReviewInitiated;
  }

  if (SYSTEM_PROGRESS_DETAIL_KEYS.refundCompleted.has(detail)) {
    return copy.orderDetail.systemProgress.refundCompleted;
  }

  return input.detail;
}
