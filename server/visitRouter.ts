import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointmentMessages } from "../drizzle/schema";
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
      const { db, appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      const recentMessages = await db
        .select()
        .from(appointmentMessages)
        .where(eq(appointmentMessages.appointmentId, appointment.id))
        .orderBy(
          desc(appointmentMessages.createdAt),
          desc(appointmentMessages.id)
        )
        .limit(input.limit);

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
      const { db, appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      if (input.clientMsgId) {
        const existing = await db
          .select({
            id: appointmentMessages.id,
            senderType: appointmentMessages.senderType,
            createdAt: appointmentMessages.createdAt,
          })
          .from(appointmentMessages)
          .where(
            and(
              eq(appointmentMessages.appointmentId, appointment.id),
              eq(appointmentMessages.clientMsgId, input.clientMsgId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return existing[0];
        }
      }

      const createdAt = new Date();
      const senderType = role === "doctor" ? "doctor" : "patient";
      const insertResult = await db.insert(appointmentMessages).values({
        appointmentId: appointment.id,
        senderType,
        content: input.content,
        clientMsgId: input.clientMsgId ?? null,
        createdAt,
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

      const latestRows = await db
        .select({
          id: appointmentMessages.id,
          senderType: appointmentMessages.senderType,
          createdAt: appointmentMessages.createdAt,
        })
        .from(appointmentMessages)
        .where(eq(appointmentMessages.appointmentId, appointment.id))
        .orderBy(desc(appointmentMessages.id))
        .limit(1);

      if (latestRows.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve inserted message",
        });
      }

      return latestRows[0];
    }),

  pollNewMessagesByToken: publicProcedure
    .input(pollMessagesInputSchema)
    .output(
      z.object({
        messages: z.array(messageSchema),
      })
    )
    .query(async ({ input }) => {
      const { db, appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );

      if (!input.afterCreatedAt && !input.afterId) {
        return { messages: [] };
      }

      const filters = [eq(appointmentMessages.appointmentId, appointment.id)];
      if (input.afterCreatedAt && input.afterId) {
        const createdAtOrIdFilter = or(
          gt(appointmentMessages.createdAt, input.afterCreatedAt),
          and(
            eq(appointmentMessages.createdAt, input.afterCreatedAt),
            gt(appointmentMessages.id, input.afterId)
          )
        );
        if (!createdAtOrIdFilter) {
          return { messages: [] };
        }
        filters.push(createdAtOrIdFilter);
      } else if (input.afterCreatedAt) {
        filters.push(gt(appointmentMessages.createdAt, input.afterCreatedAt));
      } else if (input.afterId) {
        filters.push(gt(appointmentMessages.id, input.afterId));
      }

      const newMessages = await db
        .select()
        .from(appointmentMessages)
        .where(and(...filters))
        .orderBy(
          asc(appointmentMessages.createdAt),
          asc(appointmentMessages.id)
        )
        .limit(input.limit);

      return {
        messages: normalizeMessages(newMessages),
      };
    }),
});
