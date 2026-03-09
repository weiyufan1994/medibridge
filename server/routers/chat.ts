import { publicProcedure, router } from "../_core/trpc";
import { chatActions, chatSchemas } from "../modules/chat/routerApi";

export const chatRouter = router({
  sendMessage: publicProcedure
    .input(chatSchemas.sendMessageInputSchema)
    .output(chatSchemas.sendMessageOutputSchema)
    .mutation(({ input }) => chatActions.sendMessageAction(input)),

  getSession: publicProcedure
    .input(chatSchemas.getSessionInputSchema)
    .query(({ input }) => chatActions.getSessionAction(input)),
});
