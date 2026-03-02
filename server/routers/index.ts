import { systemRouter } from "../_core/systemRouter";
import { router } from "../_core/trpc";
import { appointmentsRouter } from "../appointmentsRouter";
import { visitRouter } from "../visitRouter";
import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { chatRouter } from "./chat";
import { doctorsRouter } from "./doctors";
import { hospitalsRouter } from "./hospitals";

export const appRouter = router({
  system: systemRouter,
  ai: aiRouter,
  auth: authRouter,
  chat: chatRouter,
  doctors: doctorsRouter,
  hospitals: hospitalsRouter,
  appointments: appointmentsRouter,
  visit: visitRouter,
});

export type AppRouter = typeof appRouter;

export default appRouter;
