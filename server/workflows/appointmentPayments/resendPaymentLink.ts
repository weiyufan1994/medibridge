import type { Request } from "express";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { appointmentPaymentLinkApi } from "../../modules/appointments/publicApi";
import { reinitiateCheckoutForAppointment } from "./reinitiateCheckout";

export function resendPaymentLinkForPatient(input: {
  appointmentId: number;
  operatorId: number | null;
  req: Request;
}) {
  return appointmentPaymentLinkApi.resendPaymentLinkByPatient({
    appointmentId: input.appointmentId,
    operatorId: input.operatorId,
    baseUrl: getPublicBaseUrl(input.req),
    reinitiateCheckout: reinitiateCheckoutForAppointment,
  });
}
