import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure } from "../../../_core/trpc";
import { appointmentsAdminApi } from "../../appointments/publicApi";
import { schedulingAdminApi } from "../../scheduling/publicApi";
import { settleStripePaymentBySessionId } from "../../../workflows/appointmentPayments/publicApi";
import { adminWebhookReplaySchema } from "../schemas";
import { buildWebhookReplayEventRow, resolveActorRole } from "../support";

export const webhookReplayProcedures = {
  adminWebhookReplay: adminOrOpsProcedure
    .input(adminWebhookReplaySchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const replayKey = input.replayKey?.trim().length
        ? input.replayKey.trim().slice(0, 80)
        : randomUUID();

      const event =
        input.eventId && input.eventId.trim().length > 0
          ? await appointmentsAdminApi.getStripeWebhookEventById(
              input.eventId.trim()
            )
          : input.appointmentId
            ? ((
                await appointmentsAdminApi.listStripeWebhookEventsForAppointment(
                  {
                    appointmentId: input.appointmentId,
                    limit: 1,
                  }
                )
              )[0] ?? null)
            : null;

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook event not found",
        });
      }

      const marker = `admin_webhook_replay:${replayKey}:${event.eventId}`;
      if (!event.appointmentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Webhook event has no linked appointment",
        });
      }

      const alreadyDone = await appointmentsAdminApi.hasAppointmentStatusReason(
        {
          appointmentId: event.appointmentId,
          reason: marker,
        }
      );
      if (alreadyDone) {
        return {
          ok: false,
          skipped: true,
          action: "skipped-idempotent",
          eventId: event.eventId,
        } as const;
      }

      const result = buildWebhookReplayEventRow({
        event: {
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
        },
        action: event.type,
      });

      if (
        event.type === "checkout.session.completed" ||
        event.type === "payment_intent.payment_failed" ||
        event.type === "checkout.session.expired" ||
        event.type === "charge.refunded" ||
        event.type === "refund.updated"
      ) {
        if (!event.stripeSessionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Webhook event is missing stripe session id",
          });
        }

        if (event.type === "checkout.session.completed") {
          const appointment = await appointmentsAdminApi.getAppointmentById(
            event.appointmentId
          );
          if (!appointment) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Appointment not found for webhook replay",
            });
          }

          await settleStripePaymentBySessionId({
            stripeSessionId: event.stripeSessionId,
            source: "webhook",
            eventId: event.eventId,
          });
          await appointmentsAdminApi.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: appointment.status,
            toStatus: "paid",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              sourceStatus: appointment.status,
              sourcePaymentStatus: appointment.paymentStatus,
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          return {
            ok: true,
            skipped: false,
            action: result.action,
            eventId: event.eventId,
          } as const;
        }

        if (event.type === "checkout.session.expired") {
          const expired =
            await appointmentsAdminApi.tryTransitionAppointmentByStripeSessionId(
              {
                stripeSessionId: event.stripeSessionId,
                allowedFrom: ["pending_payment"],
                toStatus: "expired",
                toPaymentStatus: "expired",
                operatorType: "admin",
                operatorId: ctx.user.id,
                reason: "admin_webhook_replay",
                payloadJson: {
                  ...result,
                  actorRole,
                },
              }
            );
          if (!expired.ok) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Unable to replay expired webhook: ${expired.reason}`,
            });
          }
          await appointmentsAdminApi.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: "pending_payment",
            toStatus: "expired",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          await schedulingAdminApi.releaseHeldSlotByAppointmentId({
            appointmentId: event.appointmentId,
          });
          return {
            ok: true,
            skipped: false,
            action: result.action,
            eventId: event.eventId,
          } as const;
        }

        if (event.type === "payment_intent.payment_failed") {
          const failed =
            await appointmentsAdminApi.tryTransitionAppointmentByStripeSessionId(
              {
                stripeSessionId: event.stripeSessionId,
                allowedFrom: ["pending_payment"],
                toStatus: "canceled",
                toPaymentStatus: "failed",
                operatorType: "admin",
                operatorId: ctx.user.id,
                reason: "admin_webhook_replay",
                payloadJson: {
                  ...result,
                  actorRole,
                },
              }
            );
          if (!failed.ok) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Unable to replay failed payment webhook: ${failed.reason}`,
            });
          }
          await appointmentsAdminApi.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: "pending_payment",
            toStatus: "canceled",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          await schedulingAdminApi.releaseHeldSlotByAppointmentId({
            appointmentId: event.appointmentId,
          });
          return {
            ok: true,
            skipped: false,
            action: result.action,
            eventId: event.eventId,
          } as const;
        }

        const refund =
          await appointmentsAdminApi.tryTransitionAppointmentByStripeSessionId({
            stripeSessionId: event.stripeSessionId,
            allowedFrom: ["paid", "active", "ended", "completed"],
            toStatus: "refunded",
            toPaymentStatus: "refunded",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: "admin_webhook_replay",
            payloadJson: {
              ...result,
              actorRole,
            },
          });
        if (!refund.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Unable to replay refund webhook: ${refund.reason}`,
          });
        }
        await appointmentsAdminApi.insertStatusEvent({
          appointmentId: event.appointmentId,
          fromStatus: "paid",
          toStatus: "refunded",
          operatorType: "admin",
          operatorId: ctx.user.id,
          reason: marker,
          payloadJson: {
            source: "webhook_replay",
            event: result,
            idempotencyKey: replayKey,
            actorRole,
          },
        });
        return {
          ok: true,
          skipped: false,
          action: result.action,
          eventId: event.eventId,
        } as const;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported webhook event for replay: ${event.type}`,
      });
    }),
};
