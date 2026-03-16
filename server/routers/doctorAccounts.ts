import { adminOrOpsProcedure, protectedProcedure, router } from "../_core/trpc";
import { doctorAccountActions, doctorAccountSchemas } from "../modules/doctorAccounts/routerApi";

export const doctorAccountsRouter = router({
  getMyBinding: protectedProcedure
    .output(doctorAccountSchemas.myDoctorBindingOutputSchema)
    .query(({ ctx }) => doctorAccountActions.getMyDoctorBinding(ctx.user.id)),

  getDoctorAccountStatus: adminOrOpsProcedure
    .input(doctorAccountSchemas.revokeDoctorBindingInputSchema)
    .output(doctorAccountSchemas.doctorAccountStatusOutputSchema)
    .query(({ input }) => doctorAccountActions.getDoctorAccountStatus(input.doctorId)),

  invite: adminOrOpsProcedure
    .input(doctorAccountSchemas.inviteDoctorAccountInputSchema)
    .output(doctorAccountSchemas.inviteDoctorAccountOutputSchema)
    .mutation(({ input, ctx }) =>
      doctorAccountActions.inviteDoctorAccount({
        doctorId: input.doctorId,
        email: input.email,
        createdByUserId: ctx.user.id,
        req: ctx.req,
      })
    ),

  resendInvite: adminOrOpsProcedure
    .input(doctorAccountSchemas.cancelInviteInputSchema)
    .output(doctorAccountSchemas.inviteDoctorAccountOutputSchema)
    .mutation(({ input, ctx }) =>
      doctorAccountActions.resendDoctorInvite({
        inviteId: input.inviteId,
        actorUserId: ctx.user.id,
        req: ctx.req,
      })
    ),

  cancelInvite: adminOrOpsProcedure
    .input(doctorAccountSchemas.cancelInviteInputSchema)
    .mutation(({ input }) =>
      doctorAccountActions.cancelDoctorInvite({
        inviteId: input.inviteId,
      })
    ),

  revokeBinding: adminOrOpsProcedure
    .input(doctorAccountSchemas.revokeDoctorBindingInputSchema)
    .mutation(({ input, ctx }) =>
      doctorAccountActions.revokeDoctorBinding({
        doctorId: input.doctorId,
        actorUserId: ctx.user.id,
      })
    ),

  claimInvite: protectedProcedure
    .input(doctorAccountSchemas.claimDoctorInviteInputSchema)
    .output(doctorAccountSchemas.claimDoctorInviteOutputSchema)
    .mutation(({ input, ctx }) =>
      doctorAccountActions.claimDoctorInvite({
        token: input.token,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
      })
    ),
});
