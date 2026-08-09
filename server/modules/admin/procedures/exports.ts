import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure } from "../../../_core/trpc";
import { appointmentsAdminApi } from "../../appointments/publicApi";
import * as adminRepo from "../repo";
import { adminExportSchema } from "../schemas";
import { formatCsvRows, normalizeAmountFilter, toDate } from "../support";

export const exportProcedures = {
  adminExport: adminOrOpsProcedure
    .input(adminExportSchema)
    .mutation(async ({ input }) => {
      const baseFilters = {
        page: 1,
        pageSize: input.pageSize,
        status: input.status,
        paymentStatus: input.paymentStatus,
        emailQuery: input.emailQuery,
        doctorId: input.doctorId,
        amountMin: normalizeAmountFilter(input.amountMin, "min"),
        amountMax: normalizeAmountFilter(input.amountMax, "max"),
        createdAtFrom: toDate(input.createdAtFrom),
        createdAtTo: toDate(input.createdAtTo),
        scheduledAtFrom: toDate(input.scheduledAtFrom),
        scheduledAtTo: toDate(input.scheduledAtTo),
        hasRisk: input.hasRisk,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
      } as const;

      if (input.scope === "appointments") {
        const queryResult =
          await appointmentsAdminApi.listAppointmentsForAdmin(baseFilters);
        const rows = queryResult.items.map(item => ({
          id: item.id,
          email: item.email,
          status: item.status,
          paymentStatus: item.paymentStatus,
          amount: item.amount,
          currency: item.currency,
          doctorId: item.doctorId,
          createdAt: item.createdAt,
          scheduledAt: item.scheduledAt,
          riskCodes: item.riskCodes.join("|"),
          hasRisk: item.hasRisk,
        }));

        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-appointments-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(rows, null, 2),
          } as const;
        }

        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-appointments-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(rows),
        } as const;
      }

      if (input.scope === "risk_summary") {
        const queryResult =
          await appointmentsAdminApi.listAppointmentsForAdmin(baseFilters);
        const summary = {
          total: queryResult.total,
          page: queryResult.page,
          pageSize: queryResult.pageSize,
          totalPages: queryResult.totalPages,
          pendingPaymentTimeout: queryResult.riskSummary.pendingPaymentTimeout,
          webhookFailure: queryResult.riskSummary.webhookFailure,
          tokenExpiringSoon: queryResult.riskSummary.tokenExpiringSoon,
          tokenUsageExhausted: queryResult.riskSummary.tokenUsageExhausted,
        };
        const payload = [summary];
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-risk-summary-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-risk-summary-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "retention_audits") {
        const rows = await adminRepo.listRetentionCleanupAudits(
          input.auditPageSize
        );
        const details = (json: unknown) =>
          (json as {
            freeCandidates?: number;
            paidCandidates?: number;
            totalCandidates?: number;
          }) ?? {};
        const payload = rows.map(row => ({
          id: row.id,
          dryRun: row.dryRun === 1,
          freeRetentionDays: row.freeRetentionDays,
          paidRetentionDays: row.paidRetentionDays,
          freeCandidates: details(row.detailsJson).freeCandidates,
          paidCandidates: details(row.detailsJson).paidCandidates,
          totalCandidates: details(row.detailsJson).totalCandidates,
          scannedMessages: row.scannedMessages,
          deletedMessages: row.deletedMessages,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-retention-audits-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-retention-audits-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "webhook_timeline") {
        const timeline = input.webhookAppointmentId
          ? await appointmentsAdminApi.listStripeWebhookEventsForAppointment({
              appointmentId: input.webhookAppointmentId,
              limit: input.pageSize,
            })
          : [];
        const payload = timeline.map(event => ({
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
          payloadHash: event.payloadHash,
          createdAt: event.createdAt,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-webhook-timeline-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-webhook-timeline-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "operation_audit") {
        const result =
          await appointmentsAdminApi.listAppointmentStatusEventsForAdmin({
            page: input.auditPage,
            pageSize: input.auditPageSize,
            operatorId: input.auditOperatorId,
            actionType: input.auditActionType,
            from: toDate(input.auditFrom),
            to: toDate(input.auditTo),
          });
        const payload = result.items.map(item => ({
          id: item.id,
          appointmentId: item.appointmentId,
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          operatorType: item.operatorType,
          operatorId: item.operatorId,
          reason: item.reason,
          createdAt: item.createdAt,
          payloadJson: item.payloadJson,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-operation-audit-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-operation-audit-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unsupported export scope",
      });
    }),
};
