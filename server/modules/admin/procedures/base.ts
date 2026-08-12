import { z } from "zod";
import { notifyOwner } from "../../../_core/notification";
import { getMetricsSnapshot } from "../../../_core/metrics";
import {
  adminOrOpsProcedure,
  adminProcedure,
  publicProcedure,
} from "../../../_core/trpc";

export const healthInputSchema = z.object({
  timestamp: z.number().min(0, "timestamp cannot be negative"),
});

export const notifyOwnerInputSchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
});

export const baseProcedures = {
  health: publicProcedure.input(healthInputSchema).query(() => ({
    ok: true,
  })),

  notifyOwner: adminProcedure
    .input(notifyOwnerInputSchema)
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  metrics: adminOrOpsProcedure.query(() => {
    return {
      generatedAt: new Date().toISOString(),
      counters: getMetricsSnapshot(),
    } as const;
  }),
};
