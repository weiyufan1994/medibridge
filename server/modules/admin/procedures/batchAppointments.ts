import { randomUUID } from "node:crypto";
import { adminOrOpsProcedure } from "../../../_core/trpc";
import { getPublicBaseUrl } from "../../../_core/getPublicBaseUrl";
import { sendMagicLinkEmail } from "../../../_core/mailer";
import {
  appointmentsAdminApi,
  issueAppointmentAccessLinks,
  setCachedPatientAccessToken,
} from "../../appointments/publicApi";
import { reinitiateCheckoutForAppointment } from "../../../workflows/appointmentPayments/publicApi";
import { adminBatchAppointmentActionSchema } from "../schemas";
import {
  ADMIN_ALLOWED_TRANSITION_FROM,
  assertAdminAction,
  normalizeBatchActionInput,
  resolveActorRole,
} from "../support";

export const batchAppointmentProcedures = {
  adminBatchAppointmentsAction: adminOrOpsProcedure
    .input(adminBatchAppointmentActionSchema)
    .mutation(async ({ input, ctx }) => {
      const normalized = normalizeBatchActionInput(input);
      const actorRole = resolveActorRole(ctx.user?.role);

      if (normalized.action !== "resend_access_link") {
        assertAdminAction(ctx.user?.role);
      }

      const idempotencyKey = normalized.idempotencyKey?.trim().length
        ? normalized.idempotencyKey
        : randomUUID();
      const visited = new Set<number>();
      const results: Array<{
        appointmentId: number;
        status: "success" | "skipped" | "failed";
        reason?: string;
      }> = [];

      for (const appointmentId of input.appointmentIds) {
        if (visited.has(appointmentId)) {
          continue;
        }
        visited.add(appointmentId);

        const marker = `admin_batch:${normalized.action}:${idempotencyKey}:${appointmentId}`;
        const alreadyProcessed =
          await appointmentsAdminApi.hasAppointmentStatusReason({
            appointmentId,
            reason: marker,
          });
        if (alreadyProcessed) {
          results.push({
            appointmentId,
            status: "skipped",
            reason: "idempotency key replay",
          });
          continue;
        }

        try {
          const appointment =
            await appointmentsAdminApi.getAppointmentById(appointmentId);
          if (!appointment) {
            results.push({
              appointmentId,
              status: "failed",
              reason: "Appointment not found",
            });
            continue;
          }

          if (normalized.action === "reinitiate_payment") {
            const result = await reinitiateCheckoutForAppointment({
              appointment,
              baseUrl: getPublicBaseUrl(ctx.req),
              operatorType: "admin",
              operatorId: ctx.user.id,
            });
            await appointmentsAdminApi.insertStatusEvent({
              appointmentId,
              fromStatus: appointment.status,
              toStatus: result.status,
              operatorType: "admin",
              operatorId: ctx.user.id,
              reason: marker,
              payloadJson: {
                source: "admin_batch",
                action: "reinitiate_payment",
                idempotencyKey,
                actorRole,
              },
            });
            results.push({ appointmentId, status: "success" });
            continue;
          }

          if (normalized.action === "resend_access_link") {
            if (appointment.paymentStatus !== "paid") {
              results.push({
                appointmentId,
                status: "failed",
                reason: "Appointment is not paid",
              });
              continue;
            }

            const issued = await issueAppointmentAccessLinks({
              appointmentId: appointment.id,
              createdBy: `${actorRole}:${ctx.user.id}:batch_resend_access_link`,
            });
            setCachedPatientAccessToken(
              appointment.id,
              issued.patient.token,
              issued.expiresAt
            );
            await sendMagicLinkEmail(appointment.email, issued.patientLink);
            await appointmentsAdminApi.insertStatusEvent({
              appointmentId,
              fromStatus: appointment.status,
              toStatus: appointment.status,
              operatorType: "admin",
              operatorId: ctx.user.id,
              reason: marker,
              payloadJson: {
                action: "resend_access_link",
                patientLink: issued.patientLink,
                doctorLink: issued.doctorLink,
                idempotencyKey,
                actorRole,
              },
            });
            results.push({ appointmentId, status: "success" });
            continue;
          }

          const toStatus = normalized.toStatus;
          const toPaymentStatus = normalized.toPaymentStatus;
          if (!toStatus || !toPaymentStatus) {
            results.push({
              appointmentId,
              status: "failed",
              reason: "Missing status update payload",
            });
            continue;
          }

          const transitioned =
            await appointmentsAdminApi.tryTransitionAppointmentById({
              appointmentId: appointment.id,
              allowedFrom: ADMIN_ALLOWED_TRANSITION_FROM,
              toStatus,
              toPaymentStatus,
              operatorType: "admin",
              operatorId: ctx.user.id,
              reason: input.reason,
              payloadJson: {
                source: "admin_batch",
                idempotencyKey,
                appointmentId,
              },
            });

          if (!transitioned.ok) {
            results.push({
              appointmentId,
              status: "failed",
              reason: `Transition failed: ${transitioned.reason}`,
            });
            continue;
          }

          await appointmentsAdminApi.insertStatusEvent({
            appointmentId,
            fromStatus: appointment.status,
            toStatus,
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "admin_batch",
              sourceStatus: appointment.status,
              sourcePaymentStatus: appointment.paymentStatus,
              toStatus,
              toPaymentStatus,
              idempotencyKey,
              actorRole,
            },
          });
          results.push({ appointmentId, status: "success" });
        } catch (error) {
          results.push({
            appointmentId,
            status: "failed",
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        results,
        summary: {
          total: results.length,
          success: results.filter(item => item.status === "success").length,
          skipped: results.filter(item => item.status === "skipped").length,
          failed: results.filter(item => item.status === "failed").length,
        },
        idempotencyKey,
      } as const;
    }),
};
