import type { RequestMetadata } from "@shared/requestMetadata";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { appointmentPaymentLinkApi } from "../../modules/appointments/publicApi";
import { reinitiateCheckoutForAppointment } from "./reinitiateCheckout";

export function resendPaymentLinkForPatient(input: {
  appointmentId: number;
  operatorId: number | null;
  requestMetadata: RequestMetadata;
}) {
  return appointmentPaymentLinkApi.resendPaymentLinkByPatient({
    appointmentId: input.appointmentId,
    operatorId: input.operatorId,
    baseUrl: getPublicBaseUrl(input.requestMetadata),
    reinitiateCheckout: reinitiateCheckoutForAppointment,
  });
}
