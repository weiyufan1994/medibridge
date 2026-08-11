import { appointmentBookingApi } from "../../modules/appointments/publicApi";
import { paymentProviderApi } from "../../modules/payments/publicApi";

type CreateInput = Omit<
  Parameters<typeof appointmentBookingApi.createCheckoutFromCreateInput>[0],
  "createCheckoutSession"
>;
type CreateV2Input = Omit<
  Parameters<typeof appointmentBookingApi.createCheckoutFromCreateV2Input>[0],
  "createCheckoutSession"
>;

export function createAppointmentCheckout(input: CreateInput) {
  return appointmentBookingApi.createCheckoutFromCreateInput({
    ...input,
    createCheckoutSession: paymentProviderApi.createCheckoutSession,
  });
}

export function createAppointmentCheckoutV2(input: CreateV2Input) {
  return appointmentBookingApi.createCheckoutFromCreateV2Input({
    ...input,
    createCheckoutSession: paymentProviderApi.createCheckoutSession,
  });
}
