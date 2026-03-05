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
  now: Date = new Date()
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
        message: "Payment has been pending for over 30 minutes.",
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
      message: "At least one active access token expires within 2 hours.",
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
      message: "An active token reached max uses and may block room access.",
    });
  }

  if (hasWebhookFailure(detail.webhookEvents)) {
    risks.push({
      code: "WEBHOOK_FAILURE",
      level: "critical",
      message: "Webhook failure events detected in payment timeline.",
    });
  }

  const hasMessages = (detail.recentMessages?.length ?? 0) > 0;
  if (paymentStatus === "paid" && status === "paid" && hasMessages) {
    risks.push({
      code: "PAID_BUT_NOT_ACTIVE",
      level: "warning",
      message: "Messages exist while appointment is not active yet.",
    });
  }

  return risks;
}

export function computeAdminSuggestions(
  detail: AdminDetailInput | null | undefined,
  risks: AdminRiskItem[]
): AdminSuggestion[] {
  if (!detail?.appointment) {
    return [];
  }

  const status = String(detail.appointment.status ?? "");
  const paymentStatus = String(detail.appointment.paymentStatus ?? "");
  const suggestions: AdminSuggestion[] = [];
  const riskCodes = new Set(risks.map(item => item.code));

  if (riskCodes.has("PENDING_PAYMENT_TIMEOUT")) {
    suggestions.push({
      key: "suggest_reinitiate_payment",
      title: "Re-initiate checkout",
      detail: "Pending payment timed out. Create a fresh checkout session.",
      action: "reinitiate_payment",
      priority: 100,
    });
  }

  if (riskCodes.has("WEBHOOK_FAILURE")) {
    suggestions.push({
      key: "suggest_inspect_webhook",
      title: "Inspect webhook timeline",
      detail: "Webhook failures detected. Check event sequence before retrying payment.",
      action: "inspect_webhook_timeline",
      priority: 95,
    });
  }

  if (paymentStatus === "paid" && (status === "paid" || status === "active")) {
    suggestions.push({
      key: "suggest_resend_access_link",
      title: "Resend patient access link",
      detail: "Payment is settled. Resend entry link if patient cannot enter room.",
      action: "resend_access_link",
      priority: 80,
    });
    suggestions.push({
      key: "suggest_issue_access_links",
      title: "Issue new access links",
      detail: "Revoke old links and issue a fresh patient/doctor pair.",
      action: "issue_access_links",
      priority: 70,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      key: "suggest_monitor_only",
      title: "No urgent action",
      detail: "Current state looks stable. Continue monitoring timeline updates.",
      action: "monitor_only",
      priority: 10,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}
