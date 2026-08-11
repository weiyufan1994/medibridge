import * as repo from "./repo";

export const appointmentsAdminApi = {
  get getAppointmentById() {
    return repo.getAppointmentById;
  },
  get getStripeWebhookEventById() {
    return repo.getStripeWebhookEventById;
  },
  get hasAppointmentStatusReason() {
    return repo.hasAppointmentStatusReason;
  },
  get insertStatusEvent() {
    return repo.insertStatusEvent;
  },
  get listActiveAppointmentTokens() {
    return repo.listActiveAppointmentTokens;
  },
  get listAppointmentsForAdmin() {
    return repo.listAppointmentsForAdmin;
  },
  get listAppointmentStatusEventsForAdmin() {
    return repo.listAppointmentStatusEventsForAdmin;
  },
  get listStatusEventsByAppointment() {
    return repo.listStatusEventsByAppointment;
  },
  get listStripeWebhookEventsForAppointment() {
    return repo.listStripeWebhookEventsForAppointment;
  },
  get tryTransitionAppointmentById() {
    return repo.tryTransitionAppointmentById;
  },
  get tryTransitionAppointmentByStripeSessionId() {
    return repo.tryTransitionAppointmentByStripeSessionId;
  },
  get updateAppointmentById() {
    return repo.updateAppointmentById;
  },
};
export {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  type AppointmentStatus,
} from "./stateMachine";
export { setCachedPatientAccessToken } from "./tokenCache";
export { issueAppointmentAccessLinks } from "./tokenService";
export { appointmentPaymentApi } from "./paymentLifecycleActions";
export type {
  AppointmentCheckoutSnapshot,
  AppointmentPaymentDbExecutor,
} from "./paymentLifecycleActions";
