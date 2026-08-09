import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure } from "../../../_core/trpc";
import { aiAdminApi } from "../../ai/publicApi";
import { appointmentsAdminApi } from "../../appointments/publicApi";
import { doctorsAdminApi, toLocalizedTextValue } from "../../doctors/publicApi";
import { visitAdminApi } from "../../visit/publicApi";
import { adminAppointmentDetailInputSchema } from "../schemas";
import { parseIntakeFromNotes } from "../support";

export const appointmentDetailProcedures = {
  adminAppointmentDetail: adminOrOpsProcedure
    .input(adminAppointmentDetailInputSchema)
    .query(async ({ input }) => {
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const triageSession = await aiAdminApi.getAiChatSessionById(
        appointment.triageSessionId
      );
      const activeTokens =
        await appointmentsAdminApi.listActiveAppointmentTokens({
          appointmentId: appointment.id,
        });
      const statusEvents =
        await appointmentsAdminApi.listStatusEventsByAppointment({
          appointmentId: appointment.id,
          limit: 100,
        });
      const webhookEvents =
        await appointmentsAdminApi.listStripeWebhookEventsForAppointment({
          appointmentId: appointment.id,
          stripeSessionId: appointment.stripeSessionId,
          limit: 100,
        });
      const doctor = await doctorsAdminApi.getDoctorById(appointment.doctorId);
      const recentMessagesDesc = await visitAdminApi.getRecentMessages(
        appointment.id,
        30
      );
      const recentMessagesAsc = [...recentMessagesDesc].reverse();

      return {
        appointment: {
          id: appointment.id,
          userId: appointment.userId,
          email: appointment.email,
          doctorId: appointment.doctorId,
          triageSessionId: appointment.triageSessionId,
          appointmentType: appointment.appointmentType,
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
          amount: appointment.amount,
          currency: appointment.currency,
          stripeSessionId: appointment.stripeSessionId,
          scheduledAt: appointment.scheduledAt,
          paidAt: appointment.paidAt,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
        doctor: doctor
          ? {
              id: doctor.doctor.id,
              name: toLocalizedTextValue(
                doctor.doctor.name,
                doctor.doctor.nameEn
              ),
              hospitalName: toLocalizedTextValue(
                doctor.hospital.name,
                doctor.hospital.nameEn
              ),
              departmentName: toLocalizedTextValue(
                doctor.department.name,
                doctor.department.nameEn
              ),
            }
          : null,
        triageSession: triageSession
          ? {
              id: triageSession.id,
              status: triageSession.status,
              summary: triageSession.summary,
              summaryGeneratedAt: triageSession.summaryGeneratedAt,
            }
          : null,
        intake: parseIntakeFromNotes(appointment.notes),
        activeTokens: activeTokens.map(token => ({
          id: token.id,
          role: token.role,
          expiresAt: token.expiresAt,
          useCount: token.useCount,
          maxUses: token.maxUses,
          lastUsedAt: token.lastUsedAt,
          ipFirstSeen: token.ipFirstSeen,
        })),
        statusEvents: statusEvents.map(event => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          operatorType: event.operatorType,
          operatorId: event.operatorId,
          reason: event.reason,
          payloadJson: event.payloadJson,
          createdAt: event.createdAt,
        })),
        webhookEvents: webhookEvents.map(event => ({
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
          payloadHash: event.payloadHash,
          createdAt: event.createdAt,
        })),
        recentMessages: recentMessagesAsc.map(message => ({
          id: message.id,
          senderType: message.senderType,
          content: message.content,
          originalContent: message.originalContent,
          translatedContent: message.translatedContent,
          sourceLanguage: message.sourceLanguage,
          targetLanguage: message.targetLanguage,
          createdAt: message.createdAt,
        })),
      };
    }),
};
