import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure, adminProcedure } from "../../../_core/trpc";
import * as adminRepo from "../repo";
import {
  retentionCleanupAuditListSchema,
  retentionCleanupRunSchema,
  retentionPolicyUpsertSchema,
} from "../schemas";

export const retentionProcedures = {
  adminRetentionPolicies: adminOrOpsProcedure.query(async () => {
    try {
      const rows = await adminRepo.ensureDefaultRetentionPolicies();
      return rows.map(row => ({
        id: row.id,
        tier: row.tier,
        retentionDays: row.retentionDays,
        enabled: row.enabled === 1,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    } catch {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "RETENTION_STORAGE_UNAVAILABLE",
      });
    }
  }),

  adminUpsertRetentionPolicy: adminProcedure
    .input(retentionPolicyUpsertSchema)
    .mutation(async ({ input, ctx }) => {
      let updated: Awaited<
        ReturnType<typeof adminRepo.upsertRetentionPolicy>
      > | null = null;
      try {
        updated = await adminRepo.upsertRetentionPolicy({
          tier: input.tier,
          retentionDays: input.retentionDays,
          enabled: input.enabled,
          updatedBy: ctx.user.id,
        });
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to persist retention policy",
        });
      }

      return {
        id: updated.id,
        tier: updated.tier,
        retentionDays: updated.retentionDays,
        enabled: updated.enabled === 1,
        updatedBy: updated.updatedBy,
        updatedAt: updated.updatedAt,
      } as const;
    }),

  adminRunRetentionCleanup: adminProcedure
    .input(retentionCleanupRunSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return adminRepo.runRetentionCleanup({
          dryRun: input.dryRun,
          createdBy: ctx.user.id,
        });
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }
    }),

  adminRetentionCleanupAudits: adminOrOpsProcedure
    .input(retentionCleanupAuditListSchema)
    .query(async ({ input }) => {
      try {
        const rows = await adminRepo.listRetentionCleanupAudits(input.limit);
        return rows.map(row => ({
          id: row.id,
          dryRun: row.dryRun === 1,
          freeRetentionDays: row.freeRetentionDays,
          paidRetentionDays: row.paidRetentionDays,
          scannedMessages: row.scannedMessages,
          deletedMessages: row.deletedMessages,
          detailsJson: row.detailsJson,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        }));
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }
    }),
};
