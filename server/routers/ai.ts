import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { aiActions, aiSchemas } from "../modules/ai/routerApi";

export const aiRouter = router({
  getUsageSummary: protectedProcedure.query(({ ctx }) =>
    aiActions.getUsageSummaryAction(ctx.user)
  ),

  listMySessions: protectedProcedure
    .input(aiSchemas.listMySessionsInputSchema)
    .query(({ ctx, input }) => aiActions.listMySessionsAction(ctx.user, input)),

  createSession: publicProcedure
    .input(aiSchemas.createSessionInputSchema)
    .mutation(({ ctx, input }) => aiActions.createSessionAction(ctx, input)),

  sendMessage: publicProcedure
    .input(aiSchemas.sendMessageInputSchema)
    .mutation(({ input, ctx }) => aiActions.sendMessageAction(input, ctx.user)),

  chatTriage: publicProcedure
    .input(aiSchemas.chatTriageInputSchema)
    .mutation(({ input }) => aiActions.chatTriageAction(input)),
});
