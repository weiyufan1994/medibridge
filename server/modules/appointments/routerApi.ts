import * as appointmentActions from "./actions";
import * as appointmentSchemas from "./schemas";
import { listAppointmentPackages } from "./packageCatalog";
import { validateAppointmentToken } from "./accessValidation";
import {
  revokeAccessTokenByInput,
  validateAccessTokenContext,
} from "./tokenActions";
import {
  exchangeAppointmentTokenForVisitChat,
  refreshVisitChatAccessToken,
} from "./visitChatAccess";

export const appointmentCore = {
  listAppointmentPackages,
  validateAppointmentToken,
  revokeAccessTokenByInput,
  validateAccessTokenContext,
  exchangeAppointmentTokenForVisitChat,
  refreshVisitChatAccessToken,
};

export { appointmentActions, appointmentSchemas };
