import * as appointmentActions from "./actions";
import * as appointmentSchemas from "./schemas";
import { listAppointmentPackages } from "./packageCatalog";
import { validateAppointmentToken } from "./accessValidation";
import { revokeAccessTokenByInput, validateAccessTokenContext } from "./tokenActions";

export const appointmentCore = {
  listAppointmentPackages,
  validateAppointmentToken,
  revokeAccessTokenByInput,
  validateAccessTokenContext,
};

export { appointmentActions, appointmentSchemas };
