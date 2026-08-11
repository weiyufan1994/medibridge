import { publicProcedure, router } from "../_core/trpc";
import { authActions, authSchemas } from "../modules/auth/routerApi";
import {
  verifyMagicLinkAction,
  verifyOtpAndMergeAction,
} from "../workflows/authGuestUpgrade/publicApi";

export const authRouter = router({
  me: publicProcedure.query(opts => authActions.getMeUser(opts.ctx.user)),

  requestOtp: publicProcedure
    .input(authSchemas.emailInputSchema)
    .output(authSchemas.requestOtpOutputSchema)
    .mutation(({ input }) => authActions.requestOtpAction(input)),

  verifyOtpAndMerge: publicProcedure
    .input(authSchemas.verifyOtpInputSchema)
    .output(authSchemas.verifyOtpAndMergeOutputSchema)
    .mutation(({ input, ctx }) =>
      verifyOtpAndMergeAction({
        payload: input,
        req: ctx.req,
        res: ctx.res,
      })
    ),

  verifyMagicLink: publicProcedure
    .input(authSchemas.verifyMagicLinkInputSchema)
    .output(authSchemas.verifyMagicLinkOutputSchema)
    .mutation(({ input, ctx }) =>
      verifyMagicLinkAction({
        payload: input,
        req: ctx.req,
        res: ctx.res,
        deviceId: ctx.deviceId,
      })
    ),

  logout: publicProcedure
    .output(authSchemas.logoutOutputSchema)
    .mutation(({ ctx }) =>
      authActions.logoutAction({ req: ctx.req, res: ctx.res })
    ),
});
