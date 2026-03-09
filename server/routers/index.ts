import { systemRouter } from "../_core/systemRouter";
import { router } from "../_core/trpc";
import { appointmentsRouter } from "./appointments";
import { paymentsRouter } from "./payments";
import { visitRouter } from "./visit";
import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { chatRouter } from "./chat";
import { doctorsRouter } from "./doctors";
import { hospitalsRouter } from "./hospitals";
import { consultationRouter } from "./consultation";

export const appRouter = router({
  system: systemRouter,
  ai: aiRouter,
  auth: authRouter,
  chat: chatRouter,
  doctors: doctorsRouter,
  hospitals: hospitalsRouter,
  consultation: consultationRouter,
  appointments: appointmentsRouter,
  payments: paymentsRouter,
  visit: visitRouter,
});

export type AppRouter = typeof appRouter;

export default appRouter;
