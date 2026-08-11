import * as referralRepo from "./repo";

export function mapOrderToSummary(
  order: Awaited<ReturnType<typeof referralRepo.getReferralOrderById>>
) {
  if (!order) {
    throw new Error("Referral order is required");
  }

  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    manualFulfillmentRequired: order.manualFulfillmentRequired === 1,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt ?? null,
    fulfillmentDeadlineAt: order.fulfillmentDeadlineAt ?? null,
  };
}

export function mapBundleToOrderSummary(
  bundle: NonNullable<
    Awaited<ReturnType<typeof referralRepo.getReferralOrderBundleById>>
  >
) {
  return mapOrderToSummary(bundle.order);
}
