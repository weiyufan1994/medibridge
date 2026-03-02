import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointmentMessages } from "../drizzle/schema";
import * as visitRepo from "./modules/visit/repo";
import { validateAppointmentToken } from "./appointmentsRouter";
import { publicProcedure, router } from "./_core/trpc";

const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

const getMessagesInputSchema = accessInputSchema.extend({
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const sendMessageInputSchema = accessInputSchema.extend({
  content: z.string().trim().min(1).max(4000),
  clientMsgId: z.string().trim().min(1).max(128).optional(),
});

const pollMessagesInputSchema = accessInputSchema.extend({
  afterCreatedAt: z
    .union([z.string().datetime(), z.date()])
    .transform(value => (value instanceof Date ? value : new Date(value)))
    .optional(),
  afterId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

const messageSchema = z.object({
  id: z.number().int().positive(),
  senderType: z.enum(["patient", "doctor", "system"]),
  content: z.string(),
  createdAt: z.date(),
  clientMsgId: z.string().nullable(),
});

function normalizeMessages(
  messages: (typeof appointmentMessages.$inferSelect)[]
) {
  return messages.map(message => ({
    id: message.id,
    senderType: message.senderType,
    content: message.content,
    createdAt: message.createdAt,
    clientMsgId: message.clientMsgId,
  }));
}

export const visitRouter = router({
  getMessagesByToken: publicProcedure
    .input(getMessagesInputSchema)
    .output(
      z.object({
        messages: z.array(messageSchema),
      })
    )
    .query(async ({ input }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      const recentMessages = await visitRepo.getRecentMessages(
        appointment.id,
        input.limit
      );

      return {
        messages: normalizeMessages(recentMessages.reverse()),
      };
    }),

  sendMessageByToken: publicProcedure
    .input(sendMessageInputSchema)
    .output(
      z.object({
        id: z.number().int().positive(),
        senderType: z.enum(["patient", "doctor", "system"]),
        createdAt: z.date(),
      })
    )
    .mutation(async ({ input }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      if (input.clientMsgId) {
        const existing = await visitRepo.getMessageByClientMsgId(
          appointment.id,
          input.clientMsgId
        );

        if (existing) {
          return existing;
        }
      }

      const createdAt = new Date();
      const senderType = role === "doctor" ? "doctor" : "patient";
      const insertResult = await visitRepo.createMessage({
        appointmentId: appointment.id,
        senderType,
        content: input.content,
        createdAt,
        clientMsgId: input.clientMsgId,
      });

      const insertId = Number(
        (insertResult as { insertId?: number })?.insertId ??
          (Array.isArray(insertResult)
            ? (insertResult[0] as { insertId?: number } | undefined)?.insertId
            : NaN)
      );

      if (Number.isInteger(insertId) && insertId > 0) {
        return {
          id: insertId,
          senderType,
          createdAt,
        };
      }

      const latest = await visitRepo.getLatestMessage(appointment.id);
      if (!latest) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve inserted message",
        });
      }

      return latest;
    }),

  pollNewMessagesByToken: publicProcedure
    .input(pollMessagesInputSchema)
    .output(
      z.object({
        messages: z.array(messageSchema),
      })
    )
    .query(async ({ input }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      if (!input.afterCreatedAt && !input.afterId) {
        return { messages: [] };
      }

      const newMessages = await visitRepo.pollMessages({
        appointmentId: appointment.id,
        afterCreatedAt: input.afterCreatedAt,
        afterId: input.afterId,
        limit: input.limit,
      });

      return {
        messages: normalizeMessages(newMessages),
      };
    }),
});
