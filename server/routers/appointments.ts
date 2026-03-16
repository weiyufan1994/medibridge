import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getPublicBaseUrl } from "../_core/getPublicBaseUrl";
import { paymentCore } from "../modules/payments/routerApi";
import { appointmentActions, appointmentCore, appointmentSchemas } from "../modules/appointments/routerApi";

export const validateAppointmentToken = appointmentCore.validateAppointmentToken;
export const appointmentsRouter = router({
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
    .query(async ({ ctx }) => appointmentActions.listMyAppointmentsByContext(ctx)),

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

  create: publicProcedure
    .input(appointmentSchemas.createInputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.createCheckoutFromCreateInput({
        createInput: input,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email,
        req: ctx.req,
      })
    ),

  createV2: publicProcedure
    .input(appointmentSchemas.createV2InputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.createCheckoutFromCreateV2Input({
        createInput: input,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email,
        req: ctx.req,
      })
    ),

  getStatus: publicProcedure
    .input(appointmentSchemas.appointmentStatusInputSchema)
    .output(appointmentSchemas.appointmentStatusOutputSchema)
    .query(async ({ input }) => appointmentActions.getAppointmentStatus(input)),

  resendPaymentLink: publicProcedure
    .input(appointmentSchemas.appointmentStatusInputSchema)
    .output(appointmentSchemas.createOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.resendPaymentLinkByPatient({
        appointmentId: input.appointmentId,
        operatorId: ctx.user?.id ?? null,
        req: ctx.req,
        getBaseUrl: getPublicBaseUrl,
        reinitiateCheckout: paymentCore.reinitiateCheckoutForAppointment,
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

  getByToken: publicProcedure
    .input(appointmentSchemas.accessWithLangInputSchema)
    .output(appointmentSchemas.appointmentAccessOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.getAppointmentAccessByTokenWithDefaultIntake({
        appointmentId: input.appointmentId,
        token: input.token,
        lang: input.lang,
        req: ctx.req,
      })
    ),

  rescheduleByToken: publicProcedure
    .input(appointmentSchemas.rescheduleInputSchema)
    .output(appointmentSchemas.appointmentPublicSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.rescheduleByTokenFlow({
        appointmentId: input.appointmentId,
        token: input.token,
        newScheduledAt: input.newScheduledAt,
        req: ctx.req,
      })
    ),

  joinInfoByToken: publicProcedure
    .input(appointmentSchemas.accessInputSchema)
    .output(appointmentSchemas.joinInfoOutputSchema)
    .query(async ({ input, ctx }) =>
      appointmentActions.getJoinInfoByToken({
        appointmentId: input.appointmentId,
        token: input.token,
        req: ctx.req,
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
        token: input.token,
        req: ctx.req,
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

  completeAppointment: publicProcedure
    .input(appointmentSchemas.completeAppointmentInputSchema)
    .output(appointmentSchemas.completeAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.completeAppointmentByTokenFlow({
        appointmentId: input.appointmentId,
        token: input.token,
        operatorId: ctx.user?.id ?? null,
        req: ctx.req,
      })
    ),

  generateMedicalSummaryDraft: publicProcedure
    .input(appointmentSchemas.generateMedicalSummaryDraftInputSchema)
    .output(appointmentSchemas.medicalSummaryDraftOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.generateMedicalSummaryDraftByTokenFlow({
        appointmentId: input.appointmentId,
        token: input.token,
        lang: input.lang,
        forceRegenerate: input.forceRegenerate,
        req: ctx.req,
      })
    ),

  signMedicalSummary: publicProcedure
    .input(appointmentSchemas.signMedicalSummaryInputSchema)
    .output(appointmentSchemas.completeAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) =>
      appointmentActions.signMedicalSummaryByTokenFlow({
        appointmentId: input.appointmentId,
        token: input.token,
        operatorId: ctx.user?.id ?? null,
        chiefComplaint: input.chiefComplaint,
        historyOfPresentIllness: input.historyOfPresentIllness,
        pastMedicalHistory: input.pastMedicalHistory,
        assessmentDiagnosis: input.assessmentDiagnosis,
        planRecommendations: input.planRecommendations,
        req: ctx.req,
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
});
