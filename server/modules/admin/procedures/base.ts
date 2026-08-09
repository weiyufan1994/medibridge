import { z } from "zod";
import { notifyOwner } from "../../../_core/notification";
import { getMetricsSnapshot } from "../../../_core/metrics";
import {
  adminOrOpsProcedure,
  adminProcedure,
  publicProcedure,
} from "../../../_core/trpc";

export const baseProcedures = {
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
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
