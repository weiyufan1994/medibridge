import { publicProcedure, router } from "../_core/trpc";
import { visitActions, visitSchemas } from "../modules/visit/routerApi";

export const visitRouter = router({
  roomGetMessages: publicProcedure
    .input(visitSchemas.roomGetMessagesInputSchema)
    .output(visitSchemas.roomGetMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.roomGetMessagesByToken(input, ctx.requestMetadata)
    ),

  getMessagesByToken: publicProcedure
    .input(visitSchemas.getMessagesInputSchema)
    .output(visitSchemas.getMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.getMessagesByToken(input, ctx.requestMetadata)
    ),

  sendMessageByToken: publicProcedure
    .input(visitSchemas.sendMessageInputSchema)
    .output(visitSchemas.sendMessageOutputSchema)
    .mutation(({ input, ctx }) =>
      visitActions.sendMessageByToken(input, ctx.requestMetadata)
    ),

  pollNewMessagesByToken: publicProcedure
    .input(visitSchemas.pollMessagesInputSchema)
    .output(visitSchemas.pollMessagesOutputSchema)
    .query(({ input, ctx }) =>
      visitActions.pollNewMessagesByToken(input, ctx.requestMetadata)
    ),
});
