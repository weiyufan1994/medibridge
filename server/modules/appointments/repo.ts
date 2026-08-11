export {
  getActiveAppointmentTokenByHash,
  getAppointmentTokenByHash,
  getAppointmentTokenCooldownRemainingSeconds,
  getLatestAppointmentTokenIssuedAt,
  listActiveAppointmentTokens,
} from "./tokenReadRepo";
export type { AppointmentTokenRole } from "./tokenReadRepo";
export {
  createAppointmentTokenIfMissing,
  revokeAppointmentTokens,
  saveTokenFirstSeen,
  updateActiveAppointmentTokenExpiry,
  updateTokenUsageIfAllowed,
} from "./tokenWriteRepo";
export {
  insertStatusEvent,
  markAppointmentPendingPayment,
  recordIllegalStatusTransition,
  tryMarkPaidByStripeSessionId,
  tryTransitionAppointmentById,
  tryTransitionAppointmentByStripeSessionId,
} from "./lifecycleRepo";
export {
  getMedicalSummaryByAppointmentId,
  upsertMedicalSummaryByAppointmentId,
} from "./medicalSummaryRepo";
export {
  getStripeWebhookEventById,
  insertStripeWebhookEvent,
  listStripeWebhookEventsForAppointment,
} from "./webhookEventRepo";
export { markAppointmentInSessionIfNeeded } from "./sessionTransitionRepo";
export {
  countStatusEventsByAppointment,
  hasAppointmentStatusReason,
  listAppointmentStatusEventsForAdmin,
  listStatusEventsByAppointment,
} from "./statusEventReadRepo";
export {
  findLatestAppointmentIdByLookup,
  getAppointmentById,
  getAppointmentByStripeSessionId,
  getCheckoutResultByStripeSessionId,
} from "./coreReadRepo";
export {
  listAppointmentsByDoctor,
  listAppointmentsByEmail,
  listAppointmentsByUserOrEmail,
  listAppointmentsByUserScope,
} from "./listReadRepo";
export { createAppointmentDraft } from "./draftWriteRepo";
export { updateAppointmentById } from "./updateWriteRepo";
export { updateAppointmentNotesIfMatch } from "./notesWriteRepo";
export { bindAppointmentsToUserByEmail } from "./userBindingWriteRepo";
export { listAppointmentsForAdmin } from "./adminListReadRepo";

export type { AppointmentRepoExecutor } from "./repoExecutor";
