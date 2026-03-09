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

type AdminLang = "zh" | "en";

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
        message:
          lang === "zh"
            ? "支付待处理超过 30 分钟。"
            : "Payment has been pending for over 30 minutes.",
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
      message:
        lang === "zh"
          ? "至少有一个有效访问令牌将在 2 小时内过期。"
          : "At least one active access token expires within 2 hours.",
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
      message:
        lang === "zh"
          ? "有一个活跃令牌已达最大使用次数，可能会阻止进入会诊室。"
          : "An active token reached max uses and may block room access.",
    });
  }

  if (hasWebhookFailure(detail.webhookEvents)) {
    risks.push({
      code: "WEBHOOK_FAILURE",
      level: "critical",
      message:
        lang === "zh"
          ? "支付时间线中检测到 Webhook 失败事件。"
          : "Webhook failure events detected in payment timeline.",
    });
  }

  const hasMessages = (detail.recentMessages?.length ?? 0) > 0;
  if (paymentStatus === "paid" && status === "paid" && hasMessages) {
    risks.push({
      code: "PAID_BUT_NOT_ACTIVE",
      level: "warning",
      message:
        lang === "zh"
          ? "在未激活状态下已产生会诊消息。"
          : "Messages exist while appointment is not active yet.",
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
        message:
          lang === "zh"
            ? `医生回复超时：患者已等待 ${waitingMinutes} 分钟。`
            : `Doctor reply SLA overdue: patient has waited ${waitingMinutes} minutes.`,
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
    suggestions.push({
      key: "suggest_reinitiate_payment",
      title: lang === "zh" ? "重发起支付流程" : "Re-initiate checkout",
      detail:
        lang === "zh"
          ? "支付待处理时间过长。创建新的支付会话。"
          : "Pending payment timed out. Create a fresh checkout session.",
      action: "reinitiate_payment",
      priority: 100,
    });
  }

  if (riskCodes.has("WEBHOOK_FAILURE")) {
    suggestions.push({
      key: "suggest_inspect_webhook",
      title: lang === "zh" ? "检查 webhook 时间线" : "Inspect webhook timeline",
      detail:
        lang === "zh"
          ? "检测到 webhook 失败。请先检查事件顺序，再重试支付。"
          : "Webhook failures detected. Check event sequence before retrying payment.",
      action: "inspect_webhook_timeline",
      priority: 95,
    });
  }

  if (riskCodes.has("DOCTOR_REPLY_SLA_OVERDUE")) {
    suggestions.push({
      key: "suggest_notify_doctor_followup",
      title: lang === "zh" ? "提醒医生跟进" : "Notify doctor follow-up",
      detail:
        lang === "zh"
          ? "患者消息尚未被处理。立即触发医生跟进提醒。"
          : "Patient message is waiting. Trigger doctor follow-up reminder now.",
      action: "notify_doctor_followup",
      priority: 92,
    });
  }

  if (paymentStatus === "paid" && (status === "paid" || status === "active")) {
    suggestions.push({
      key: "suggest_resend_access_link",
      title: lang === "zh" ? "重发患者入室链接" : "Resend patient access link",
      detail:
        lang === "zh"
          ? "支付已完成。若患者无法进入会诊室，请重新发送入室链接。"
          : "Payment is settled. Resend entry link if patient cannot enter room.",
      action: "resend_access_link",
      priority: 80,
    });
    suggestions.push({
      key: "suggest_issue_access_links",
      title:
        lang === "zh"
          ? "签发新的患者/医生访问链接"
          : "Issue new access links",
      detail:
        lang === "zh"
          ? "作废旧链接并重新签发一对新的患者/医生链接。"
          : "Revoke old links and issue a fresh patient/doctor pair.",
      action: "issue_access_links",
      priority: 70,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      key: "suggest_monitor_only",
      title: lang === "zh" ? "无紧急动作" : "No urgent action",
      detail:
        lang === "zh"
          ? "当前状态看起来稳定，持续监测时间线更新。"
          : "Current state looks stable. Continue monitoring timeline updates.",
      action: "monitor_only",
      priority: 10,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}
