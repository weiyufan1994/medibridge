import { publicProcedure, router } from "../_core/trpc";
import { visitActions, visitSchemas } from "../modules/visit/routerApi";

export const visitRouter = router({
  roomGetMessages: publicProcedure
    .input(visitSchemas.roomGetMessagesInputSchema)
    .output(visitSchemas.roomGetMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.roomGetMessagesByToken(input, ctx.req)
    ),

  getMessagesByToken: publicProcedure
    .input(visitSchemas.getMessagesInputSchema)
    .output(visitSchemas.getMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.getMessagesByToken(input, ctx.req)
    ),

  sendMessageByToken: publicProcedure
    .input(visitSchemas.sendMessageInputSchema)
    .output(visitSchemas.sendMessageOutputSchema)
    .mutation(({ input, ctx }) =>
      visitActions.sendMessageByToken(input, ctx.req)
    ),

  pollNewMessagesByToken: publicProcedure
    .input(visitSchemas.pollMessagesInputSchema)
    .output(visitSchemas.pollMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.pollNewMessagesByToken(input, ctx.req)
    ),
});
