import { TRPCError } from "@trpc/server";
import {
  appointmentPaymentApi,
  type AppointmentCheckoutSnapshot,
} from "../../modules/appointments/publicApi";
import { paymentProviderApi } from "../../modules/payments/publicApi";

export async function reinitiateCheckoutForAppointment(input: {
  appointment: AppointmentCheckoutSnapshot;
  baseUrl: string;
  operatorType: "system" | "patient" | "admin";
  operatorId: number | null;
}) {
  appointmentPaymentApi.assertCheckoutCanBeReinitiated(input.appointment);

  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, "");
  if (!normalizedBaseUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
  }

  const checkout = await paymentProviderApi.createCheckoutSession({
    appointmentId: input.appointment.id,
    amount: input.appointment.amount,
    currency: input.appointment.currency,
    successUrl: `${normalizedBaseUrl}/payment/success`,
    cancelUrl: `${normalizedBaseUrl}/payment/cancel`,
  });

  await appointmentPaymentApi.attachReinitiatedCheckout({
    appointment: input.appointment,
    checkoutSessionId: checkout.id,
    paymentProvider: checkout.provider,
    operatorType: input.operatorType,
    operatorId: input.operatorId,
  });

  return {
    appointmentId: input.appointment.id,
    checkoutSessionUrl: checkout.url,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    stripeSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}
