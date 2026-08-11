import { appointmentAutomationApi } from "../../modules/appointments/publicApi";
import { visitAutomationApi } from "../../modules/visit/publicApi";

export function startAppointmentAutoCloseWorker(options?: {
  intervalMs?: number;
  runOnStart?: boolean;
}) {
  return appointmentAutomationApi.startAutoCloseWorker({
    ...options,
    createSystemMessage: visitAutomationApi.createMessage,
  });
}
