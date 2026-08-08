import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure, adminProcedure } from "../../../_core/trpc";
import { aiRepo } from "../../ai/publicApi";
import { appointmentsRepo } from "../../appointments/publicApi";
import { visitRepo } from "../../visit/publicApi";
import * as adminRepo from "../repo";
import { renderSimpleTextPdf } from "../pdf";
import {
  adminAppointmentDetailInputSchema,
  adminSummaryInputSchema,
  adminSummaryPdfInputSchema,
} from "../schemas";
import { deriveSummaryText, toLocalizedText } from "../support";
import { generateBilingualVisitSummary } from "../visitSummary";

export const visitSummaryProcedures = {
  adminGetVisitSummary: adminOrOpsProcedure
    .input(adminAppointmentDetailInputSchema)
    .query(async ({ input }) => {
      const summary = await adminRepo.getVisitSummaryByAppointmentId(
        input.appointmentId
      );
      if (!summary) {
        return null;
      }
      return {
        id: summary.id,
        appointmentId: summary.appointmentId,
        summary: toLocalizedText({
          zh: summary.summaryZh,
          en: summary.summaryEn,
        }),
        source: summary.source,
        generatedBy: summary.generatedBy,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
      } as const;
    }),

  adminGenerateVisitSummary: adminProcedure
    .input(adminSummaryInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const existing = await adminRepo.getVisitSummaryByAppointmentId(
        appointment.id
      );
      if (existing && !input.forceRegenerate) {
        return {
          appointmentId: appointment.id,
          summary: toLocalizedText({
            zh: existing.summaryZh,
            en: existing.summaryEn,
          }),
          source: existing.source,
          generatedAt: existing.updatedAt ?? existing.createdAt,
          cached: true,
        } as const;
      }

      const triageSession = await aiRepo.getAiChatSessionById(
        appointment.triageSessionId
      );
      const recentMessagesDesc = await visitRepo.getRecentMessages(
        appointment.id,
        120
      );
      const recentMessagesAsc = [...recentMessagesDesc].reverse();

      const generated = await generateBilingualVisitSummary({
        appointment,
        triageSummary: triageSession?.summary ?? null,
        messages: recentMessagesAsc.map(message => ({
          senderType: message.senderType,
          content: message.content,
          translatedContent: message.translatedContent,
          createdAt: message.createdAt,
        })),
      });

      const persisted = await adminRepo.upsertVisitSummary({
        appointmentId: appointment.id,
        summaryZh: generated.summaryZh,
        summaryEn: generated.summaryEn,
        source: generated.source,
        generatedBy: ctx.user.id,
      });

      return {
        appointmentId: appointment.id,
        summary: toLocalizedText({
          zh: persisted?.summaryZh ?? generated.summaryZh,
          en: persisted?.summaryEn ?? generated.summaryEn,
        }),
        source: persisted?.source ?? generated.source,
        generatedAt: persisted?.updatedAt ?? persisted?.createdAt ?? new Date(),
        cached: false,
      } as const;
    }),

  adminExportVisitSummaryPdf: adminProcedure
    .input(adminSummaryPdfInputSchema)
    .mutation(async ({ input, ctx }) => {
      let summary = await adminRepo.getVisitSummaryByAppointmentId(
        input.appointmentId
      );

      if (!summary) {
        const appointment = await appointmentsRepo.getAppointmentById(
          input.appointmentId
        );
        if (!appointment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Appointment not found",
          });
        }

        const triageSession = await aiRepo.getAiChatSessionById(
          appointment.triageSessionId
        );
        const recentMessagesDesc = await visitRepo.getRecentMessages(
          appointment.id,
          120
        );
        const recentMessagesAsc = [...recentMessagesDesc].reverse();

        const generated = await generateBilingualVisitSummary({
          appointment,
          triageSummary: triageSession?.summary ?? null,
          messages: recentMessagesAsc.map(message => ({
            senderType: message.senderType,
            content: message.content,
            translatedContent: message.translatedContent,
            createdAt: message.createdAt,
          })),
        });

        summary = await adminRepo.upsertVisitSummary({
          appointmentId: appointment.id,
          summaryZh: generated.summaryZh,
          summaryEn: generated.summaryEn,
          source: generated.source,
          generatedBy: ctx.user.id,
        });
      }

      if (!summary) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load summary",
        });
      }

      const text = deriveSummaryText({
        appointmentId: summary.appointmentId,
        summaryZh: summary.summaryZh,
        summaryEn: summary.summaryEn,
        generatedAt: summary.updatedAt ?? summary.createdAt,
        source: summary.source,
        lang: input.lang,
      });
      const pdf = renderSimpleTextPdf(text);

      return {
        appointmentId: summary.appointmentId,
        filename: `visit-summary-${summary.appointmentId}-${input.lang}.pdf`,
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
        generatedAt: new Date().toISOString(),
      } as const;
    }),
};
