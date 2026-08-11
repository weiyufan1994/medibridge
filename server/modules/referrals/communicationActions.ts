import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { notifyPatientReferralUpdate } from "./notifications";
import * as referralRepo from "./repo";
import type {
  addInternalNoteInputSchema,
  publishPatientProgressUpdateInputSchema,
} from "./schemas";

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
