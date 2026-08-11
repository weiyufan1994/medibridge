import * as repo from "./repo";
import * as guestAssetRepo from "./guestAssetRepo";
import {
  createCheckoutFromCreateInput,
  createCheckoutFromCreateV2Input,
} from "./bookingActions";
import { generateMedicalSummaryDraftByTokenFlow } from "./workflowActions";
import { startAppointmentAutoCloseWorker } from "./autoCloseWorker";
import { validateAppointmentAccessToken } from "./tokenValidation";
import { validateAppointmentToken } from "./accessValidation";
import { canJoinRoom, canSendMessage } from "./chatPolicy";
import { resolveConsultationTimerState } from "./consultationTimer";
import { extendConsultationByDoctorTokenFlow } from "./timerActions";
import {
  markAppointmentInSessionAfterFirstMessage,
  touchAppointmentVisitAccess,
} from "./visitIntegrationActions";

export const appointmentAuthApi = {
  get bindAppointmentsToUserByEmail() {
    return repo.bindAppointmentsToUserByEmail;
  },
  get getAppointmentById() {
    return repo.getAppointmentById;
  },
  get reassignAppointmentsFromGuest() {
    return guestAssetRepo.reassignAppointmentsFromGuest;
  },
  get updateAppointmentById() {
    return repo.updateAppointmentById;
  },
  validateAppointmentAccessToken,
};

export const appointmentBookingApi = {
  createCheckoutFromCreateInput,
  createCheckoutFromCreateV2Input,
};

export const appointmentMedicalSummaryApi = {
  generateMedicalSummaryDraftByTokenFlow,
};

export const appointmentAutomationApi = {
  startAutoCloseWorker: startAppointmentAutoCloseWorker,
};

export const appointmentVisitApi = {
  canJoinRoom,
  canSendMessage,
  extendConsultationByDoctorToken: extendConsultationByDoctorTokenFlow,
  get getAppointmentById() {
    return repo.getAppointmentById;
  },
  markInSessionAfterFirstMessage: markAppointmentInSessionAfterFirstMessage,
  resolveConsultationTimerState,
  touchVisitAccess: touchAppointmentVisitAccess,
  validateAccessToken: validateAppointmentAccessToken,
  validateToken: validateAppointmentToken,
};

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
  type PaymentStatus,
} from "./stateMachine";
export { setCachedPatientAccessToken } from "./tokenCache";
export { issueAppointmentAccessLinks } from "./tokenService";
export { appointmentPaymentApi } from "./paymentLifecycleActions";
export type {
  AppointmentCheckoutSnapshot,
  AppointmentPaymentDbExecutor,
} from "./paymentLifecycleActions";
