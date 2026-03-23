import {
  getAdminRiskMessage,
  getAdminSuggestionCopy,
  type AdminLang,
} from "@/features/admin/copy";

export type AdminRiskLevel = "warning" | "critical";

export type AdminRiskItem = {
  code: string;
  level: AdminRiskLevel;
  message: string;
};

export type AdminSuggestionAction =
  | "reinitiate_payment"
  | "resend_access_link"
  | "issue_access_links"
  | "notify_doctor_followup"
  | "inspect_webhook_timeline"
  | "monitor_only";

export type AdminSuggestion = {
  key: string;
  title: string;
  detail: string;
  action: AdminSuggestionAction;
  priority: number;
};

type AdminDetailInput = {
  appointment?: {
    status?: string | null;
    paymentStatus?: string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  } | null;
  activeTokens?: Array<{
    role?: string | null;
    expiresAt?: Date | string | null;
    useCount?: number | null;
    maxUses?: number | null;
  }> | null;
  webhookEvents?: Array<{
    type?: string | null;
  }> | null;
  recentMessages?: Array<{
    id?: number | null;
    senderType?: string | null;
    createdAt?: Date | string | null;
  }> | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasWebhookFailure(events: AdminDetailInput["webhookEvents"]): boolean {
  if (!events || events.length === 0) {
    return false;
  }
  return events.some(event => {
    const type = String(event.type ?? "").toLowerCase();
    return (
      type.includes("failed") ||
      type.includes("invalid") ||
      type.includes("error") ||
      type.includes("malformed") ||
      type.includes("unavailable")
    );
  });
}

export function computeAdminRisks(
  detail: AdminDetailInput | null | undefined,
  now: Date = new Date(),
  lang: AdminLang = "en"
): AdminRiskItem[] {
  if (!detail?.appointment) {
    return [];
  }

  const risks: AdminRiskItem[] = [];
  const status = String(detail.appointment.status ?? "");
  const paymentStatus = String(detail.appointment.paymentStatus ?? "");
  const createdAt = toDate(detail.appointment.createdAt);

  if (status === "pending_payment" && paymentStatus === "pending" && createdAt) {
    const ageMs = now.getTime() - createdAt.getTime();
    if (ageMs > 30 * 60 * 1000) {
      risks.push({
        code: "PENDING_PAYMENT_TIMEOUT",
        level: "warning",
        message: getAdminRiskMessage("PENDING_PAYMENT_TIMEOUT", lang),
      });
    }
  }

  const tokens = detail.activeTokens ?? [];
  const soonExpiring = tokens.some(token => {
    const expiresAt = toDate(token.expiresAt);
    if (!expiresAt) {
      return false;
    }
    const diffMs = expiresAt.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000;
  });
  if (soonExpiring) {
      risks.push({
        code: "TOKEN_EXPIRING_SOON",
        level: "warning",
        message: getAdminRiskMessage("TOKEN_EXPIRING_SOON", lang),
      });
  }

  const exhaustedToken = tokens.some(token => {
    const useCount = Number(token.useCount ?? 0);
    const maxUses = Number(token.maxUses ?? 0);
    return maxUses > 0 && useCount >= maxUses;
  });
  if (exhaustedToken) {
      risks.push({
        code: "TOKEN_USAGE_EXHAUSTED",
        level: "critical",
        message: getAdminRiskMessage("TOKEN_USAGE_EXHAUSTED", lang),
      });
  }

  if (hasWebhookFailure(detail.webhookEvents)) {
      risks.push({
        code: "WEBHOOK_FAILURE",
        level: "critical",
        message: getAdminRiskMessage("WEBHOOK_FAILURE", lang),
      });
  }

  const hasMessages = (detail.recentMessages?.length ?? 0) > 0;
  if (paymentStatus === "paid" && status === "paid" && hasMessages) {
      risks.push({
        code: "PAID_BUT_NOT_ACTIVE",
        level: "warning",
        message: getAdminRiskMessage("PAID_BUT_NOT_ACTIVE", lang),
      });
  }

  if (paymentStatus === "paid" && (status === "paid" || status === "active")) {
    const messages = detail.recentMessages ?? [];
    let latestPatientAt: Date | null = null;
    let latestDoctorAt: Date | null = null;

    for (const message of messages) {
      const sender = String(message.senderType ?? "");
      const createdAt = toDate(message.createdAt);
      if (!createdAt) {
        continue;
      }
      if (sender === "patient") {
        if (!latestPatientAt || createdAt > latestPatientAt) {
          latestPatientAt = createdAt;
        }
        continue;
      }
      if (sender === "doctor") {
        if (!latestDoctorAt || createdAt > latestDoctorAt) {
          latestDoctorAt = createdAt;
        }
      }
    }

    if (latestPatientAt) {
      const waitingMs = now.getTime() - latestPatientAt.getTime();
      const doctorRepliedAfterLatestPatient =
        latestDoctorAt && latestDoctorAt.getTime() >= latestPatientAt.getTime();
    if (!doctorRepliedAfterLatestPatient && waitingMs >= 15 * 60 * 1000) {
      const isCritical = waitingMs >= 60 * 60 * 1000;
      const waitingMinutes = Math.floor(waitingMs / 60_000);
      risks.push({
        code: "DOCTOR_REPLY_SLA_OVERDUE",
        level: isCritical ? "critical" : "warning",
        message: getAdminRiskMessage("DOCTOR_REPLY_SLA_OVERDUE", lang, {
          waitingMinutes,
        }),
      });
    }
    }
  }

  return risks;
}

export function computeAdminSuggestions(
  detail: AdminDetailInput | null | undefined,
  risks: AdminRiskItem[],
  lang: AdminLang = "en"
): AdminSuggestion[] {
  if (!detail?.appointment) {
    return [];
  }

  const status = String(detail.appointment.status ?? "");
  const paymentStatus = String(detail.appointment.paymentStatus ?? "");
  const suggestions: AdminSuggestion[] = [];
  const riskCodes = new Set(risks.map(item => item.code));

  if (riskCodes.has("PENDING_PAYMENT_TIMEOUT")) {
    const copy = getAdminSuggestionCopy("suggest_reinitiate_payment", lang);
    suggestions.push({
      key: "suggest_reinitiate_payment",
      title: copy.title,
      detail: copy.detail,
      action: "reinitiate_payment",
      priority: 100,
    });
  }

  if (riskCodes.has("WEBHOOK_FAILURE")) {
    const copy = getAdminSuggestionCopy("suggest_inspect_webhook", lang);
    suggestions.push({
      key: "suggest_inspect_webhook",
      title: copy.title,
      detail: copy.detail,
      action: "inspect_webhook_timeline",
      priority: 95,
    });
  }

  if (riskCodes.has("DOCTOR_REPLY_SLA_OVERDUE")) {
    const copy = getAdminSuggestionCopy("suggest_notify_doctor_followup", lang);
    suggestions.push({
      key: "suggest_notify_doctor_followup",
      title: copy.title,
      detail: copy.detail,
      action: "notify_doctor_followup",
      priority: 92,
    });
  }

  if (paymentStatus === "paid" && (status === "paid" || status === "active")) {
    const resendCopy = getAdminSuggestionCopy("suggest_resend_access_link", lang);
    suggestions.push({
      key: "suggest_resend_access_link",
      title: resendCopy.title,
      detail: resendCopy.detail,
      action: "resend_access_link",
      priority: 80,
    });
    const issueCopy = getAdminSuggestionCopy("suggest_issue_access_links", lang);
    suggestions.push({
      key: "suggest_issue_access_links",
      title: issueCopy.title,
      detail: issueCopy.detail,
      action: "issue_access_links",
      priority: 70,
    });
  }

  if (suggestions.length === 0) {
    const copy = getAdminSuggestionCopy("suggest_monitor_only", lang);
    suggestions.push({
      key: "suggest_monitor_only",
      title: copy.title,
      detail: copy.detail,
      action: "monitor_only",
      priority: 10,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}
