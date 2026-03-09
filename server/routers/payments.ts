import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  paymentActions,
  paymentCore,
  paymentSchemas,
} from "../modules/payments/routerApi";

export const reinitiateCheckoutForAppointment =
  paymentCore.reinitiateCheckoutForAppointment;
export const settleStripePaymentBySessionId =
  paymentCore.settleStripePaymentBySessionId;

export const paymentsRouter = router({
  createCheckoutSessionForAppointment: publicProcedure
    .input(paymentSchemas.createCheckoutSessionForAppointmentInputSchema)
    .output(paymentSchemas.createCheckoutSessionForAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      paymentActions.createCheckoutSessionForAppointmentAction({
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
      paymentActions.confirmMockCheckoutAction({
        stripeSessionId: input.stripeSessionId,
        req: ctx.req,
      })
    ),

  confirmMockCheckoutByAppointment: publicProcedure
    .input(paymentSchemas.confirmMockByAppointmentInputSchema)
    .output(paymentSchemas.confirmMockByAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      paymentActions.confirmMockCheckoutByAppointmentAction({
        appointmentId: input.appointmentId,
        req: ctx.req,
      })
    ),
});
