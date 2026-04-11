import { notifyOwner } from "../../_core/notification";

async function sendOwnerNotification(input: {
  title: string;
  content: string;
}) {
  try {
    return await notifyOwner({
      title: input.title,
      content: input.content,
    });
  } catch (error) {
    console.warn("[referrals] owner notification failed:", error);
    return false;
  }
}

export async function notifyInternalPaidReferralOrder(input: {
  orderId: number;
  hospitalName: string;
  contactName?: string | null;
  manualFulfillmentRequired?: boolean;
}) {
  return sendOwnerNotification({
    title: `New paid referral order #${input.orderId}`,
    content: input.contactName
      ? `Order #${input.orderId} is ready for claim. Hospital: ${input.hospitalName}. Contact: ${input.contactName}.`
      : input.manualFulfillmentRequired
        ? `Order #${input.orderId} is ready for claim. Hospital: ${input.hospitalName}. Manual outreach is required.`
        : `Order #${input.orderId} is ready for claim. Hospital: ${input.hospitalName}. Contact assignment is still pending.`,
  });
}

export async function notifyInternalActionRequired(input: {
  orderId: number;
  status: string;
  reason: string;
}) {
  return sendOwnerNotification({
    title: `Referral order #${input.orderId} needs action`,
    content: `Order #${input.orderId} is now ${input.status}. Reason: ${input.reason}.`,
  });
}

export async function notifyPatientReferralUpdate(input: {
  orderId: number;
  event: string;
  detail: string;
}) {
  console.log(
    `[referrals][patient-notify] order=${input.orderId} event=${input.event} detail=${input.detail}`
  );
  return true;
}
