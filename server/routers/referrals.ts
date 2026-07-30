import {
  adminOrOpsProcedure,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import {
  referralActions,
  referralSchemas,
} from "../modules/referrals/routerApi";

export const referralsRouter = router({
  getTriageRecommendations: protectedProcedure
    .input(referralSchemas.getTriageRecommendationsInputSchema)
    .output(referralSchemas.referralTriageRecommendationOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.getTriageRecommendationsAction(ctx.user, input)
    ),

  getSelectionContext: protectedProcedure
    .input(referralSchemas.getSelectionContextInputSchema)
    .output(referralSchemas.selectionContextOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.getSelectionContextAction(ctx.user, input)
    ),

  createOrderDraft: protectedProcedure
    .input(referralSchemas.createOrderDraftInputSchema)
    .output(referralSchemas.createOrderDraftOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.createOrderDraftAction(ctx.user, input)
    ),

  createPaymentSession: protectedProcedure
    .input(referralSchemas.createPaymentSessionInputSchema)
    .output(referralSchemas.createPaymentSessionOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.createPaymentSessionAction({
        user: ctx.user,
        createInput: input,
        req: ctx.req,
      })
    ),

  confirmReturnedPaymentSession: publicProcedure
    .input(referralSchemas.confirmReturnedPaymentSessionInputSchema)
    .output(referralSchemas.confirmMockPaymentOutputSchema)
    .mutation(({ input }) =>
      referralActions.confirmReturnedPaymentSessionAction({
        paymentSessionId: input.paymentSessionId,
      })
    ),

  confirmMockPayment: protectedProcedure
    .input(referralSchemas.confirmMockPaymentInputSchema)
    .output(referralSchemas.confirmMockPaymentOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.confirmMockPaymentAction(ctx.user, input)
    ),

  listMine: protectedProcedure
    .input(referralSchemas.listMineOrdersInputSchema)
    .output(referralSchemas.listMineOrdersOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.listMineOrdersAction(ctx.user, input)
    ),

  getOrderDetail: protectedProcedure
    .input(referralSchemas.getOrderDetailInputSchema)
    .output(referralSchemas.referralOrderDetailOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.getOrderDetailAction(ctx.user, input.orderId)
    ),

  listOrders: adminOrOpsProcedure
    .input(referralSchemas.listOrdersInputSchema)
    .output(referralSchemas.listOrdersOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.listOrdersForAdminAction(ctx.user, input)
    ),

  getAdminOrderDetail: adminOrOpsProcedure
    .input(referralSchemas.getOrderDetailInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .query(({ ctx, input }) =>
      referralActions.getAdminOrderDetailAction(ctx.user, input.orderId)
    ),

  claimOrder: adminOrOpsProcedure
    .input(referralSchemas.claimOrderInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.claimOrderAction(ctx.user, input)
    ),

  assignOrder: adminOrOpsProcedure
    .input(referralSchemas.assignOrderInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.assignOrderAction(ctx.user, input)
    ),

  assignOrderContact: adminOrOpsProcedure
    .input(referralSchemas.assignOrderContactInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.assignOrderContactAction(ctx.user, input)
    ),

  updateOrderStatus: adminOrOpsProcedure
    .input(referralSchemas.updateOrderStatusInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.updateOrderStatusAction(ctx.user, input)
    ),

  addInternalNote: adminOrOpsProcedure
    .input(referralSchemas.addInternalNoteInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.addInternalNoteAction(ctx.user, input)
    ),

  publishPatientProgressUpdate: adminOrOpsProcedure
    .input(referralSchemas.publishPatientProgressUpdateInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.publishPatientProgressUpdateAction(ctx.user, input)
    ),

  recordContactAttempt: adminOrOpsProcedure
    .input(referralSchemas.recordContactAttemptInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.recordContactAttemptAction(ctx.user, input)
    ),

  recordBookingResult: adminOrOpsProcedure
    .input(referralSchemas.recordBookingResultInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.recordBookingResultAction(ctx.user, input)
    ),

  beginTimeCoordination: adminOrOpsProcedure
    .input(referralSchemas.beginTimeCoordinationInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.beginTimeCoordinationAction(ctx.user, input)
    ),

  setConsultationTime: adminOrOpsProcedure
    .input(referralSchemas.setConsultationTimeInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.setConsultationTimeAction(ctx.user, input)
    ),

  initiateRefund: adminOrOpsProcedure
    .input(referralSchemas.initiateRefundInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.initiateRefundAction(ctx.user, input)
    ),

  reviewRefund: adminOrOpsProcedure
    .input(referralSchemas.reviewRefundInputSchema)
    .output(referralSchemas.adminReferralOrderDetailOutputSchema)
    .mutation(({ ctx, input }) =>
      referralActions.reviewRefundAction(ctx.user, input)
    ),

  listHospitalsForAdmin: adminOrOpsProcedure
    .output(referralSchemas.listReferralHospitalsOutputSchema)
    .query(() => referralActions.listReferralHospitalsForAdminAction()),

  listDepartmentsForAdmin: adminOrOpsProcedure
    .input(referralSchemas.listReferralDepartmentsInputSchema)
    .output(referralSchemas.listReferralDepartmentsOutputSchema)
    .query(({ input }) =>
      referralActions.listReferralDepartmentsForAdminAction(input.hospitalId)
    ),

  listContactsForAdmin: adminOrOpsProcedure
    .input(referralSchemas.listReferralContactsInputSchema)
    .output(referralSchemas.listReferralContactsOutputSchema)
    .query(({ input }) =>
      referralActions.listReferralContactsForAdminAction(input)
    ),

  listAssignableAgents: adminOrOpsProcedure
    .output(referralSchemas.listAssignableAgentsOutputSchema)
    .query(() => referralActions.listAssignableAgentsAction()),

  upsertHospital: adminProcedure
    .input(referralSchemas.upsertHospitalInputSchema)
    .output(referralSchemas.referralHospitalSchema)
    .mutation(({ input }) => referralActions.upsertHospitalAction(input)),

  upsertContact: adminProcedure
    .input(referralSchemas.upsertContactInputSchema)
    .output(referralSchemas.referralContactSchema)
    .mutation(({ input }) => referralActions.upsertContactAction(input)),

  updateHospitalActive: adminProcedure
    .input(referralSchemas.updateHospitalActiveInputSchema)
    .output(referralSchemas.referralHospitalSchema)
    .mutation(({ input }) =>
      referralActions.updateHospitalActiveAction({
        hospitalId: input.hospitalId,
        isActive: input.isActive,
      })
    ),

  updateContactActive: adminProcedure
    .input(referralSchemas.updateContactActiveInputSchema)
    .output(referralSchemas.referralContactSchema)
    .mutation(({ input }) =>
      referralActions.updateContactActiveAction({
        contactId: input.contactId,
        isActive: input.isActive,
      })
    ),
});
