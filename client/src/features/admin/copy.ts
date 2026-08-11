import type { LocalizedText } from "@shared/types";
import type {
  AdminAppointmentStatus,
  AdminPaymentStatus,
} from "@/features/admin/types";
import {
  ADMIN_OVERVIEW_COPY,
  ADMIN_USER_MANAGEMENT_COPY,
} from "@/features/admin/adminCopy/directoryData";
import {
  ADMIN_APPOINTMENT_STATUS_LABELS,
  ADMIN_CONFIRMATION_COPY,
  ADMIN_PAYMENT_STATUS_LABELS,
  ADMIN_STATUS_GUIDANCE_COPY,
} from "@/features/admin/adminCopy/statusData";
import {
  APPOINTMENT_TYPE_OPTIONS,
  EXCEPTION_ACTION_OPTIONS,
  REASON_LABELS,
  RISK_MESSAGES,
  SUGGESTION_COPY,
  WEBHOOK_TYPE_LABELS,
  WEEKDAY_OPTIONS,
} from "@/features/admin/adminCopy/operationsData";

export type AdminLang = "zh" | "en";
export type AdminConfirmationKey = Exclude<
  keyof typeof ADMIN_CONFIRMATION_COPY,
  "common"
>;

export function getAdminText(lang: AdminLang, text: LocalizedText) {
  return lang === "zh" ? text.zh : text.en;
}

export function getAdminOverviewCopy(lang: AdminLang) {
  return Object.fromEntries(
    Object.entries(ADMIN_OVERVIEW_COPY).map(([key, value]) => [
      key,
      getAdminText(lang, value),
    ])
  ) as {
    [TKey in keyof typeof ADMIN_OVERVIEW_COPY]: string;
  };
}

export function getAdminUserManagementCopy(lang: AdminLang) {
  return Object.fromEntries(
    Object.entries(ADMIN_USER_MANAGEMENT_COPY).map(([key, value]) => [
      key,
      getAdminText(lang, value),
    ])
  ) as {
    [TKey in keyof typeof ADMIN_USER_MANAGEMENT_COPY]: string;
  };
}

export function getAdminRoleCapabilitySummary(
  role: "free" | "pro" | "admin" | "ops",
  lang: AdminLang
) {
  const copy = getAdminUserManagementCopy(lang);
  if (role === "admin") return copy.adminAccess;
  if (role === "ops") return copy.operationsAccess;
  return copy.noBackendAccess;
}

export function getAdminConfirmationCopy(
  lang: AdminLang,
  key: AdminConfirmationKey
) {
  const copy = ADMIN_CONFIRMATION_COPY[key];
  return {
    title: getAdminText(lang, copy.title),
    description: getAdminText(lang, copy.description),
    confirmLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.confirm),
    continueLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.continue),
    cancelLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.cancel),
  };
}

export function getAdminStatusGuidanceCopy(lang: AdminLang) {
  return {
    referral: {
      title: getAdminText(lang, ADMIN_STATUS_GUIDANCE_COPY.referral.title),
      description: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.description
      ),
      currentStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.currentStatus
      ),
      nextStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.nextStatus
      ),
      noFixedTarget: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.noFixedTarget
      ),
      noNextStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.noNextStatus
      ),
      advanceModes: Object.fromEntries(
        Object.entries(ADMIN_STATUS_GUIDANCE_COPY.referral.advanceModes).map(
          ([key, value]) => [key, getAdminText(lang, value)]
        )
      ) as {
        [TKey in keyof typeof ADMIN_STATUS_GUIDANCE_COPY.referral.advanceModes]: string;
      },
      manualCorrectionTitle: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.manualCorrectionTitle
      ),
      manualCorrectionDescription: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.manualCorrectionDescription
      ),
      completionTitle: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionTitle
      ),
      completionDescription: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionDescription
      ),
      completionNoAutoNotice: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionNoAutoNotice
      ),
      completionReasonLabel: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionReasonLabel
      ),
      completionAction: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionAction
      ),
      statusDraftSaved: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.statusDraftSaved
      ),
    },
    appointment: {
      title: getAdminText(lang, ADMIN_STATUS_GUIDANCE_COPY.appointment.title),
      description: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.description
      ),
      currentCombination: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.currentCombination
      ),
      targetStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.targetStatus
      ),
      availableTargets: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.availableTargets
      ),
      targetPaymentStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.targetPaymentStatus
      ),
      noTransitions: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.noTransitions
      ),
      invalidSelection: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.invalidSelection
      ),
    },
    reasonRequirement: getAdminText(
      lang,
      ADMIN_STATUS_GUIDANCE_COPY.reasonRequirement
    ),
  };
}

export function getAdminAppointmentStatusLabel(
  status: AdminAppointmentStatus,
  lang: AdminLang
) {
  return getAdminText(lang, ADMIN_APPOINTMENT_STATUS_LABELS[status]);
}

export function getAdminPaymentStatusLabel(
  status: AdminPaymentStatus,
  lang: AdminLang
) {
  return getAdminText(lang, ADMIN_PAYMENT_STATUS_LABELS[status]);
}

export function getAdminReasonLabel(
  reason: string | null | undefined,
  lang: AdminLang
) {
  const raw = (reason ?? "").trim();
  if (!raw) return "-";
  const baseReason = raw.includes(":") ? raw.split(":")[0] : raw;
  const localized = REASON_LABELS[baseReason];
  if (!localized) return raw;
  const label = getAdminText(lang, localized);
  return raw.startsWith(`${baseReason}:`)
    ? `${label} (${raw.slice(baseReason.length + 1)})`
    : label;
}

export function getAdminWebhookTypeLabel(type: string, lang: AdminLang) {
  const localized = WEBHOOK_TYPE_LABELS[type];
  return localized ? getAdminText(lang, localized) : type;
}

export function getAppointmentTypeOptions(lang: AdminLang) {
  return APPOINTMENT_TYPE_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayOptions(lang: AdminLang) {
  return WEEKDAY_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayLabel(value: string, lang: AdminLang) {
  const option = WEEKDAY_OPTIONS.find(item => item.value === value);
  return option ? getAdminText(lang, option.label) : value;
}

export function getExceptionActionOptions(lang: AdminLang) {
  return EXCEPTION_ACTION_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getAdminRiskMessage(
  code: keyof typeof RISK_MESSAGES | "DOCTOR_REPLY_SLA_OVERDUE",
  lang: AdminLang,
  params?: { waitingMinutes?: number }
) {
  if (code === "PENDING_PAYMENT_TIMEOUT")
    return getAdminText(lang, RISK_MESSAGES.PENDING_PAYMENT_TIMEOUT);
  if (code === "TOKEN_EXPIRING_SOON")
    return getAdminText(lang, RISK_MESSAGES.TOKEN_EXPIRING_SOON);
  if (code === "TOKEN_USAGE_EXHAUSTED")
    return getAdminText(lang, RISK_MESSAGES.TOKEN_USAGE_EXHAUSTED);
  if (code === "WEBHOOK_FAILURE")
    return getAdminText(lang, RISK_MESSAGES.WEBHOOK_FAILURE);
  if (code === "PAID_BUT_NOT_ACTIVE")
    return getAdminText(lang, RISK_MESSAGES.PAID_BUT_NOT_ACTIVE);
  const waitingMinutes = params?.waitingMinutes ?? 0;
  return lang === "zh"
    ? `医生回复超时：患者已等待 ${waitingMinutes} 分钟。`
    : `Doctor reply SLA overdue: patient has waited ${waitingMinutes} minutes.`;
}

export function getAdminSuggestionCopy(
  key: keyof typeof SUGGESTION_COPY,
  lang: AdminLang
) {
  return {
    title: getAdminText(lang, SUGGESTION_COPY[key].title),
    detail: getAdminText(lang, SUGGESTION_COPY[key].detail),
  };
}
