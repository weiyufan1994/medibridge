import type { Request } from "express";
import { appointments } from "../../../drizzle/schema";
import { getAppointmentByIdOrThrow } from "./accessValidation";

type AppointmentRecord = typeof appointments.$inferSelect;

type ReinitiateResult = {
  appointmentId: number;
  checkoutSessionUrl: string;
  status: AppointmentRecord["status"];
  paymentStatus: AppointmentRecord["paymentStatus"];
  stripeSessionId: string | undefined;
};

type ReinitiateCheckoutFn = (input: {
  appointment: AppointmentRecord;
  baseUrl: string;
  operatorType: "system" | "patient" | "admin";
  operatorId: number | null;
}) => Promise<ReinitiateResult>;

export async function resendPaymentLinkByPatient(input: {
  appointmentId: number;
  operatorId: number | null;
  req: Request;
  getBaseUrl: (req: Request) => string;
  reinitiateCheckout: ReinitiateCheckoutFn;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  const publicUrlBase = input.getBaseUrl(input.req);
  const result = await input.reinitiateCheckout({
    appointment,
    baseUrl: publicUrlBase,
    operatorType: "patient",
    operatorId: input.operatorId,
  });

  return {
    appointmentId: result.appointmentId,
    checkoutUrl: result.checkoutSessionUrl,
    checkoutSessionUrl: result.checkoutSessionUrl,
    status: result.status,
    paymentStatus: result.paymentStatus,
    stripeSessionId: result.stripeSessionId,
  };
}
