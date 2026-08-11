import { aiActions, aiSchemas } from "../modules/ai/routerApi";
import { publicProcedure, router } from "../_core/trpc";

export const consultationRouter = router({
  getHistory: publicProcedure
    .output(aiSchemas.getHistoryOutputSchema)
    .query(({ ctx }) => aiActions.getConsultationHistory(ctx.userId)),
  getMessagesBySessionId: publicProcedure
    .input(aiSchemas.getMessagesBySessionIdInputSchema)
    .output(aiSchemas.getMessagesBySessionIdOutputSchema)
    .query(({ ctx, input }) =>
      aiActions.getConsultationMessages({
        sessionId: input.sessionId,
        userId: ctx.userId,
      })
    ),
});
