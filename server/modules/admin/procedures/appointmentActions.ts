import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../../../_core/notification";
import { getPublicBaseUrl } from "../../../_core/getPublicBaseUrl";
import { sendMagicLinkEmail } from "../../../_core/mailer";
import { adminOrOpsProcedure, adminProcedure } from "../../../_core/trpc";
import {
  appointmentsAdminApi,
  issueAppointmentAccessLinks,
  setCachedPatientAccessToken,
} from "../../appointments/publicApi";
import { doctorsAdminApi } from "../../doctors/publicApi";
import { visitAdminApi } from "../../visit/publicApi";
import { reinitiateCheckoutForAppointment } from "../../../workflows/appointmentPayments/publicApi";
import {
  adminAppointmentActionInputSchema,
  adminAppointmentScheduleUpdateSchema,
  adminAppointmentStatusUpdateSchema,
  adminNotifyDoctorFollowupInputSchema,
} from "../schemas";
import { ADMIN_ALLOWED_TRANSITION_FROM, resolveActorRole } from "../support";

export const appointmentActionProcedures = {
  adminReinitiatePayment: adminProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const result = await reinitiateCheckoutForAppointment({
        appointment,
        baseUrl: getPublicBaseUrl(ctx.req),
        operatorType: "admin",
        operatorId: ctx.user.id,
      });

      await appointmentsAdminApi.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: result.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_reinitiate_payment",
        payloadJson: {
          oldStripeSessionId: appointment.stripeSessionId,
          newStripeSessionId: result.stripeSessionId ?? null,
          actorRole,
        },
      });

      return {
        appointmentId: result.appointmentId,
        checkoutUrl: result.checkoutSessionUrl,
      } as const;
    }),

  adminResendAccessLink: adminOrOpsProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend visit link before payment is completed",
        });
      }

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: `${actorRole}:${ctx.user.id}:resend_access_link`,
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );
      await sendMagicLinkEmail(appointment.email, issued.patientLink);

      await appointmentsAdminApi.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_resend_access_link",
        payloadJson: {
          actorRole,
        },
      });

      return {
        ok: true as const,
      };
    }),

  adminIssueAccessLinks: adminOrOpsProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Issue link is only available after payment is settled",
        });
      }

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: `${actorRole}:${ctx.user.id}:issue_access_links`,
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );

      await appointmentsAdminApi.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_issue_access_links",
        payloadJson: {
          actorRole,
        },
      });

      return {
        appointmentId: appointment.id,
        patientLink: issued.patientLink,
        doctorLink: issued.doctorLink,
        expiresAt: issued.expiresAt,
      } as const;
    }),

  adminNotifyDoctorFollowup: adminOrOpsProcedure
    .input(adminNotifyDoctorFollowupInputSchema)
    .mutation(async ({ input }) => {
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const doctor = await doctorsAdminApi.getDoctorById(appointment.doctorId);
      const recentMessages = await visitAdminApi.getRecentMessages(
        appointment.id,
        20
      );
      const latestPatientMessage = recentMessages
        .filter(message => message.senderType === "patient")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const title = `Doctor follow-up reminder #${appointment.id}`;
      const content = [
        `Appointment: #${appointment.id}`,
        `Patient: ${appointment.email}`,
        `Doctor: ${
          doctor
            ? `${doctor.doctor.name} (${doctor.hospital.name}/${doctor.department.name})`
            : String(appointment.doctorId)
        }`,
        `Status: ${appointment.status}/${appointment.paymentStatus}`,
        `Latest patient message: ${latestPatientMessage?.createdAt?.toISOString() ?? "-"}`,
      ].join("\n");

      const delivered = await notifyOwner({ title, content });
      return {
        ok: delivered,
      } as const;
    }),

  adminUpdateAppointmentStatus: adminProcedure
    .input(adminAppointmentStatusUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const transitioned =
        await appointmentsAdminApi.tryTransitionAppointmentById({
          appointmentId: appointment.id,
          allowedFrom: ADMIN_ALLOWED_TRANSITION_FROM,
          toStatus: input.toStatus,
          toPaymentStatus: input.toPaymentStatus,
          operatorType: "admin",
          operatorId: ctx.user.id,
          reason: `admin_status_update:${input.reason}`,
          payloadJson: {
            actorRole,
            manual: true,
            reason: input.reason,
          },
        });

      if (!transitioned.ok) {
        throw new TRPCError({
          code:
            transitioned.reason === "not_found"
              ? "NOT_FOUND"
              : "PRECONDITION_FAILED",
          message: `Status transition failed: ${transitioned.reason}`,
        });
      }

      return {
        ok: true as const,
      };
    }),

  adminUpdateAppointmentSchedule: adminProcedure
    .input(adminAppointmentScheduleUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsAdminApi.getAppointmentById(
        input.appointmentId
      );
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const now = new Date();
      await appointmentsAdminApi.updateAppointmentById(appointment.id, {
        scheduledAt: input.scheduledAt,
        updatedAt: now,
      });

      await appointmentsAdminApi.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: `admin_schedule_update:${input.reason}`,
        payloadJson: {
          actorRole,
          fromScheduledAt:
            appointment.scheduledAt instanceof Date
              ? appointment.scheduledAt.toISOString()
              : appointment.scheduledAt,
          toScheduledAt: input.scheduledAt.toISOString(),
        },
      });

      return {
        ok: true as const,
        appointmentId: appointment.id,
        scheduledAt: input.scheduledAt,
      };
    }),
};
