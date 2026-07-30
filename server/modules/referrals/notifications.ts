import crypto from "node:crypto";
import * as referralRepo from "./repo";

type ReferralLanguage = "zh" | "en";

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

const PATIENT_EVENT_DETAIL: Record<
  string,
  { zh: string; en: string }
> = {
  payment_success: {
    zh: "已收到服务费，订单已进入平台待接单队列。",
    en: "Payment was received and your order is now waiting for a platform coordinator.",
  },
  patient_progress_update: {
    zh: "订单有新的重要进展，请登录订单页查看详情。",
    en: "Your order has an important progress update. Sign in to the order page for details.",
  },
  refund_initiated: {
    zh: "平台已收到退款申请，正在进行审核。",
    en: "Your refund request was received and is under review.",
  },
  refund_processing: {
    zh: "全额退款正在原路处理中，完成后我们会再次通知您。",
    en: "Your full refund is being returned to the original payment method. We will notify you when it completes.",
  },
  refund_completed: {
    zh: "全额退款已完成，请留意原支付账户的入账状态。",
    en: "Your full refund has completed. Please check the original payment account for settlement.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderHref(orderId: number): string | null {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/, "")}/referrals/orders/${orderId}`;
}

function buildPatientEmail(input: {
  orderId: number;
  event: string;
  detail: string;
  language: ReferralLanguage;
}): EmailContent {
  const orderHref = getOrderHref(input.orderId);
  const isChinese = input.language === "zh";
  const detail =
    PATIENT_EVENT_DETAIL[input.event]?.[input.language] ??
    input.detail.trim();
  const subject = isChinese
    ? `MediBridge 转诊订单 #${input.orderId} 更新`
    : `MediBridge referral order #${input.orderId} update`;
  const intro = isChinese
    ? `您的转诊订单 #${input.orderId} 有新的进展。`
    : `Your referral order #${input.orderId} has a new update.`;
  const linkText = isChinese ? "登录查看订单详情" : "Sign in to view order details";
  const text = [intro, detail, orderHref ? `${linkText}: ${orderHref}` : null]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    `<p>${escapeHtml(detail)}</p>`,
    orderHref
      ? `<p><a href="${escapeHtml(orderHref)}">${escapeHtml(linkText)}</a></p>`
      : "",
  ].join("");

  return { subject, text, html };
}

function buildOpsEmail(input: {
  orderId: number;
  title: string;
  detail: string;
}): EmailContent {
  const orderHref = getOrderHref(input.orderId);
  const subject = `${input.title} #${input.orderId}`;
  const text = [
    input.detail,
    orderHref ? `Open order: ${orderHref}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
  const html = [
    `<p>${escapeHtml(input.detail)}</p>`,
    orderHref
      ? `<p><a href="${escapeHtml(orderHref)}">Open referral order</a></p>`
      : "",
  ].join("");

  return { subject, text, html };
}

function getOpsRecipients(): string[] {
  return Array.from(
    new Set(
      (process.env.REFERRAL_OPS_EMAILS ?? "")
        .split(",")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function buildDedupeKey(input: {
  orderId: number;
  recipientType: "patient" | "ops";
  event: string;
  recipient: string;
  detail: string;
}): string {
  const detailHash = crypto
    .createHash("sha256")
    .update(input.detail, "utf8")
    .digest("hex")
    .slice(0, 16);
  return [
    input.orderId,
    input.recipientType,
    input.event,
    input.recipient,
    detailHash,
  ].join(":");
}

async function enqueueEmail(input: {
  orderId: number;
  event: string;
  recipientType: "patient" | "ops";
  recipient: string;
  language: ReferralLanguage;
  detail: string;
  email: EmailContent;
}) {
  await referralRepo.enqueueReferralNotification({
    values: {
      orderId: input.orderId,
      eventType: input.event,
      recipientType: input.recipientType,
      recipient: input.recipient,
      language: input.language,
      payload: input.email,
      dedupeKey: buildDedupeKey(input),
    },
  });
}

export async function notifyInternalPaidReferralOrder(input: {
  orderId: number;
  hospitalName: string;
  contactName?: string | null;
  manualFulfillmentRequired?: boolean;
}) {
  const contact = input.contactName
    ? `Coordinator: ${input.contactName}.`
    : "MediBridge coordination team assignment is required.";
  const detail = `Paid referral order for ${input.hospitalName}. ${contact}`;
  const email = buildOpsEmail({
    orderId: input.orderId,
    title: "New paid referral order",
    detail,
  });
  const recipients = getOpsRecipients();

  await Promise.all(
    recipients.map(recipient =>
      enqueueEmail({
        orderId: input.orderId,
        event: "payment_success",
        recipientType: "ops",
        recipient,
        language: "en",
        detail,
        email,
      })
    )
  );

  return recipients.length > 0;
}

export async function notifyInternalActionRequired(input: {
  orderId: number;
  status: string;
  reason: string;
}) {
  const detail = `Order is ${input.status}. Reason: ${input.reason}.`;
  const email = buildOpsEmail({
    orderId: input.orderId,
    title: "Referral order needs action",
    detail,
  });
  const recipients = getOpsRecipients();

  await Promise.all(
    recipients.map(recipient =>
      enqueueEmail({
        orderId: input.orderId,
        event: `action_required:${input.status}`,
        recipientType: "ops",
        recipient,
        language: "en",
        detail,
        email,
      })
    )
  );

  return recipients.length > 0;
}

export async function notifyPatientReferralUpdate(input: {
  orderId: number;
  event: string;
  detail: string;
  detailByLanguage?: {
    zh: string;
    en: string;
  };
}) {
  const bundle = await referralRepo.getReferralOrderBundleById(input.orderId);
  const recipient = bundle?.patient?.email?.trim().toLowerCase();
  if (!bundle || !recipient) {
    return false;
  }

  const language: ReferralLanguage =
    bundle.order.agreementLang === "en" ? "en" : "zh";
  const emailDetail =
    input.detailByLanguage?.[language] ?? input.detail;
  const email = buildPatientEmail({
    orderId: input.orderId,
    event: input.event,
    detail: emailDetail,
    language,
  });
  await enqueueEmail({
    orderId: input.orderId,
    event: input.event,
    recipientType: "patient",
    recipient,
    language,
    detail: emailDetail,
    email,
  });

  return true;
}
