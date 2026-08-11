import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import * as referralRepo from "./repo";
import { notifyPatientReferralUpdate } from "./notifications";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import type {
  addInternalNoteInputSchema,
  publishPatientProgressUpdateInputSchema,
} from "./schemas";
import {
  getAdminOrderDetailAction,
  listOrdersForAdminAction,
} from "./adminReadActions";

export {
  getSelectionContextAction,
  getTriageRecommendationsAction,
} from "./triageActions";
export { createOrderDraftAction } from "./orderDraftActions";
export { createPaymentSessionAction } from "./paymentSessionActions";
export { confirmReturnedPaymentSessionAction } from "./returnedPaymentActions";
export { confirmMockPaymentAction } from "./mockPaymentActions";
export { getAdminOrderDetailAction, listOrdersForAdminAction };
export {
  assignOrderAction,
  assignOrderContactAction,
  claimOrderAction,
} from "./assignmentActions";
export { recordBookingResultAction } from "./bookingResultActions";
export { recordContactAttemptAction } from "./contactAttemptActions";
export { initiateRefundAction } from "./refundRequestActions";
export { reviewRefundAction } from "./refundReviewActions";
export { updateOrderStatusAction } from "./manualStatusActions";
export {
  beginTimeCoordinationAction,
  setConsultationTimeAction,
} from "./schedulingActions";
export {
  getOrderDetailAction,
  listMineOrdersAction,
} from "./patientReadActions";
type AddInternalNoteInput = z.infer<typeof addInternalNoteInputSchema>;
type PublishPatientProgressUpdateInput = z.infer<
  typeof publishPatientProgressUpdateInputSchema
>;
export async function addInternalNoteAction(
  user: User | null,
  input: AddInternalNoteInput
) {
  const currentUser = requireUser(user);
  await referralRepo.insertOperation({
    orderId: input.orderId,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "internal_note",
    actionPayload: {
      note: input.note,
    },
  });

  return getAdminOrderDetailAction(currentUser, input.orderId);
}

export async function publishPatientProgressUpdateAction(
  user: User | null,
  input: PublishPatientProgressUpdateInput
) {
  const currentUser = requireUser(user);
  await referralRepo.insertOperation({
    orderId: input.orderId,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "patient_notification",
    actionPayload: {
      detail: input.detail,
    },
  });

  await notifyPatientReferralUpdate({
    orderId: input.orderId,
    event: "patient_progress_update",
    detail: input.detail,
  });

  return getAdminOrderDetailAction(currentUser, input.orderId);
}

export {
  listAssignableAgentsAction,
  listReferralContactsForAdminAction,
  listReferralDepartmentsForAdminAction,
  listReferralHospitalsForAdminAction,
  updateContactActiveAction,
  updateHospitalActiveAction,
  upsertContactAction,
  upsertHospitalAction,
} from "./catalogActions";
