import {
  appointmentActions,
  appointmentCore,
  appointmentSchemas,
} from "../modules/appointments/routerApi";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as appointmentBookingWorkflow from "../workflows/appointmentBooking/publicApi";
import { generateMedicalSummaryDraft } from "../workflows/appointmentMedicalSummary/publicApi";
import { resendPaymentLinkForPatient } from "../workflows/appointmentPayments/publicApi";
export const { validateAppointmentToken } = appointmentCore;

const appointmentQueryProcedures = {
  listPackages: publicProcedure
    .input(appointmentSchemas.listPackagesInputSchema)
    .output(appointmentSchemas.listPackagesOutputSchema)
    .query(({ input }) => appointmentCore.listAppointmentPackages(input)),
  listMine: protectedProcedure
    .input(appointmentSchemas.listMineInputSchema)
    .output(appointmentSchemas.listMineOutputSchema)
    .query(async ({ ctx, input }) =>
      appointmentActions.listMineAppointments({
        userId: ctx.user.id,
        email: ctx.user.email,
        limit: input.limit,
      })
    ),
  listMyAppointments: publicProcedure
    .output(appointmentSchemas.listMyAppointmentsOutputSchema)
    .query(async ({ ctx }) =>
      appointmentActions.listMyAppointmentsByContext(ctx)
    ),
  listDoctorWorkbench: protectedProcedure
    .input(appointmentSchemas.listDoctorWorkbenchInputSchema)
    .output(appointmentSchemas.listDoctorWorkbenchOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.listDoctorWorkbenchAppointments({
        doctorId: input.doctorId,
        limit: input.limit,
        currentUserId: ctx.user.id,
        currentUserRole: ctx.user.role,
      })
    ),
  getDoctorWorkbenchAppointmentDetail: protectedProcedure
    .input(appointmentSchemas.getDoctorWorkbenchAppointmentDetailInputSchema)
    .output(appointmentSchemas.doctorWorkbenchAppointmentDetailOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.getDoctorWorkbenchAppointmentDetail({
        appointmentId: input.appointmentId,
        doctorId: input.doctorId,
        lang: input.lang,
        currentUserId: ctx.user.id,
        currentUserRole: ctx.user.role,
      })
    ),
  getStatus: publicProcedure
    .input(appointmentSchemas.appointmentStatusInputSchema)
    .output(appointmentSchemas.appointmentStatusOutputSchema)
    .query(async ({ input }) => appointmentActions.getAppointmentStatus(input)),
};

const appointmentCheckoutProcedures = {
  create: publicProcedure
    .input(appointmentSchemas.createInputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentBookingWorkflow.createAppointmentCheckout({
        createInput: input,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  createV2: publicProcedure
    .input(appointmentSchemas.createV2InputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentBookingWorkflow.createAppointmentCheckoutV2({
        createInput: input,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  resendPaymentLink: publicProcedure
    .input(appointmentSchemas.appointmentStatusInputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      resendPaymentLinkForPatient({
        appointmentId: input.appointmentId,
        operatorId: ctx.user?.id ?? null,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  cancel: publicProcedure
    .input(appointmentSchemas.cancelInputSchema)
    .output(appointmentSchemas.appointmentStatusOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.cancelAppointmentByPatientById({
        appointmentId: input.appointmentId,
        operatorId: ctx.user?.id ?? null,
        reason: input.reason,
      })
    ),
};

const visitChatTokenMutation = (
  action: typeof appointmentCore.exchangeAppointmentTokenForVisitChat
) =>
  publicProcedure
    .input(appointmentSchemas.visitChatTokenInputSchema)
    .output(appointmentSchemas.visitChatTokenOutputSchema)
    .mutation(({ input, ctx }) =>
      action({ ...input, requestMetadata: ctx.requestMetadata })
    );

const appointmentAccessProcedures = {
  exchangeVisitChatToken: visitChatTokenMutation(
    appointmentCore.exchangeAppointmentTokenForVisitChat
  ),
  refreshVisitChatToken: visitChatTokenMutation(
    appointmentCore.refreshVisitChatAccessToken
  ),
  getByToken: publicProcedure
    .input(appointmentSchemas.accessWithLangInputSchema)
    .output(appointmentSchemas.appointmentAccessOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.getAppointmentAccessByTokenWithDefaultIntake({
        ...input,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  rescheduleByToken: publicProcedure
    .input(appointmentSchemas.rescheduleInputSchema)
    .output(appointmentSchemas.appointmentPublicSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.rescheduleByTokenFlow({
        ...input,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  joinInfoByToken: publicProcedure
    .input(appointmentSchemas.accessInputSchema)
    .output(appointmentSchemas.joinInfoOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.getJoinInfoByToken({
        ...input,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  issueAccessLinks: protectedProcedure
    .input(appointmentSchemas.issueLinksInputSchema)
    .output(appointmentSchemas.issueLinksOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.issueAccessLinksForDoctorUserByAppointmentId({
        appointmentId: input.appointmentId,
        userId: ctx.user.id,
        userRole: ctx.user.role,
      })
    ),
  openMyRoom: protectedProcedure
    .input(appointmentSchemas.openMyRoomInputSchema)
    .output(appointmentSchemas.openMyRoomOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.openMyRoomForCurrentUserById({
        appointmentId: input.appointmentId,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
      })
    ),
  validateAccessToken: publicProcedure
    .input(appointmentSchemas.validateTokenOnlyInputSchema)
    .output(appointmentSchemas.accessContextOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentCore.validateAccessTokenContext({
        ...input,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  revokeAccessToken: protectedProcedure
    .input(appointmentSchemas.revokeTokenInputSchema)
    .output(appointmentSchemas.revokeTokenOutputSchema)
    .mutation(async ({ input }) =>
      appointmentCore.revokeAccessTokenByInput({
        appointmentId: input.appointmentId,
        role: input.role,
        token: input.token,
        revokeReason: input.revokeReason,
      })
    ),
  resendLink: publicProcedure
    .input(appointmentSchemas.resendLinkInputSchema)
    .output(appointmentSchemas.resendOutputSchema)
    .mutation(async ({ input }) =>
      appointmentActions.resendPatientAccessLinkById({
        appointmentId: input.appointmentId,
      })
    ),
  resendDoctorLink: publicProcedure
    .input(appointmentSchemas.resendInputSchema)
    .output(appointmentSchemas.resendDoctorOutputSchema)
    .mutation(async ({ input }) =>
      appointmentActions.resendDoctorAccessLinkInDevById({
        appointmentId: input.appointmentId,
        email: input.email,
      })
    ),
};

const appointmentCompletionProcedures = {
  startDoctorWorkbenchAppointment: protectedProcedure
    .input(appointmentSchemas.startDoctorWorkbenchAppointmentInputSchema)
    .output(appointmentSchemas.completeAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.startAppointmentByDoctorUser({
        appointmentId: input.appointmentId,
        doctorId: input.doctorId,
        currentUserId: ctx.user.id,
        currentUserRole: ctx.user.role,
      })
    ),
  completeAppointment: publicProcedure
    .input(appointmentSchemas.completeAppointmentInputSchema)
    .output(appointmentSchemas.completeAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.completeAppointmentByTokenFlow({
        ...input,
        operatorId: ctx.user?.id ?? null,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  generateMedicalSummaryDraft: publicProcedure
    .input(appointmentSchemas.generateMedicalSummaryDraftInputSchema)
    .output(appointmentSchemas.medicalSummaryDraftOutputSchema)
    .mutation(async ({ input, ctx }) =>
      generateMedicalSummaryDraft({
        ...input,
        requestMetadata: ctx.requestMetadata,
      })
    ),
  signMedicalSummary: publicProcedure
    .input(appointmentSchemas.signMedicalSummaryInputSchema)
    .output(appointmentSchemas.completeAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.signMedicalSummaryByTokenFlow({
        ...input,
        operatorId: ctx.user?.id ?? null,
        requestMetadata: ctx.requestMetadata,
      })
    ),
};

export const appointmentsRouter = router({
  ...appointmentQueryProcedures,
  ...appointmentCheckoutProcedures,
  ...appointmentAccessProcedures,
  ...appointmentCompletionProcedures,
});
