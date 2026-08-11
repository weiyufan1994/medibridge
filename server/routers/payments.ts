import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { paymentActions, paymentSchemas } from "../modules/payments/routerApi";
import {
  confirmMockCheckoutAction,
  confirmMockCheckoutByAppointmentAction,
  createCheckoutSessionForAppointmentAction,
} from "../workflows/appointmentPayments/publicApi";

export const paymentsRouter = router({
  createCheckoutSessionForAppointment: publicProcedure
    .input(paymentSchemas.createCheckoutSessionForAppointmentInputSchema)
    .output(paymentSchemas.createCheckoutSessionForAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      createCheckoutSessionForAppointmentAction({
        appointmentId: input.appointmentId,
        operatorId: ctx.user?.id ?? null,
      })
    ),

  getCheckoutResult: publicProcedure
    .input(paymentSchemas.getCheckoutResultInputSchema)
    .output(paymentSchemas.getCheckoutResultOutputSchema)
    .query(async ({ input }) =>
      paymentActions.getCheckoutResultByStripeSession({
        stripeSessionId: input.stripeSessionId,
      })
    ),

  getStatus: protectedProcedure
    .input(paymentSchemas.getStatusInputSchema)
    .output(paymentSchemas.getStatusOutputSchema)
    .query(async ({ input, ctx }) =>
      paymentActions.getPaymentStatusByAppointmentForUser({
        appointmentId: input.appointmentId,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
      })
    ),

  confirmMockCheckout: publicProcedure
    .input(paymentSchemas.confirmMockInputSchema)
    .output(paymentSchemas.confirmMockOutputSchema)
    .mutation(async ({ input, ctx }) =>
      confirmMockCheckoutAction({
        stripeSessionId: input.stripeSessionId,
      })
    ),

  confirmMockCheckoutByAppointment: publicProcedure
    .input(paymentSchemas.confirmMockByAppointmentInputSchema)
    .output(paymentSchemas.confirmMockByAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      confirmMockCheckoutByAppointmentAction({
        appointmentId: input.appointmentId,
      })
    ),
});
