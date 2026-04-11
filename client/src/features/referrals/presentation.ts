import type { ReferralLang } from "@/features/referrals/copy";
import { getReferralCopy } from "@/features/referrals/copy";
import { getDisplayLocale } from "@/lib/i18n";
import type {
  RefundRequestStatus,
  ReferralOrderStatus,
} from "@shared/referrals";

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
  lang: ReferralLang
) {
  if (!value) {
    return getReferralCopy(lang).common.notAvailable;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return getReferralCopy(lang).common.notAvailable;
  }

  return date.toLocaleString(getDisplayLocale(lang));
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
  return `${pathname}?${search.toString()}`;
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

export function buildReferralOrderHref(orderId: number) {
  return `/referrals/orders/${orderId}`;
}

export function parsePositiveNumberParam(value: string | null | undefined) {
  const parsed = Number(value ?? NaN);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeNumberParam(value: string | null | undefined) {
  const parsed = Number(value ?? NaN);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
