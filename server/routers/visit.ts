import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointmentMessages } from "../../drizzle/schema";
import * as appointmentsRepo from "../modules/appointments/repo";
import * as visitRepo from "../modules/visit/repo";
import { validateAppointmentAccessToken } from "../modules/appointments/tokenValidation";
import { markInSessionIfTransitioned } from "../modules/visit/status";
import { translateVisitMessage } from "../modules/visit/translation";
import { validateAppointmentToken } from "./appointments";
import { publicProcedure, router } from "../_core/trpc";

const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

const getMessagesInputSchema = accessInputSchema.extend({
  limit: z.number().int().min(1).max(200).optional().default(50),
  beforeCursor: z.string().trim().min(1).optional(),
});

const roomGetMessagesInputSchema = z.object({
  token: z.string().trim().min(16).max(512),
  limit: z.number().int().min(1).max(200).optional().default(50),
  beforeCursor: z.string().trim().min(1).optional(),
});

const sendMessageInputSchema = accessInputSchema.extend({
  content: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
  targetLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
  clientMessageId: z.string().trim().min(1).max(128).optional(),
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
  originalContent: z.string(),
  translatedContent: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  createdAt: z.date(),
  clientMessageId: z.string().nullable(),
});

function encodeCursor(createdAt: Date, id: number) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const [createdAtIso, idValue] = Buffer.from(cursor, "base64url")
      .toString("utf8")
      .split("|");
    const createdAt = new Date(createdAtIso);
    const id = Number(idValue);
    if (!createdAtIso || Number.isNaN(createdAt.getTime()) || !Number.isInteger(id)) {
      return null;
    }
    return {
      createdAt,
      id,
    };
  } catch {
    return null;
  }
}

function normalizeMessages(
  messages: (typeof appointmentMessages.$inferSelect)[]
) {
  return messages.map(message => ({
    id: message.id,
    senderType: message.senderType,
    content: message.content,
    originalContent:
      message.originalContent ?? message.content ?? "",
    translatedContent:
      message.translatedContent ?? message.content ?? "",
    sourceLanguage: message.sourceLanguage ?? "auto",
    targetLanguage: message.targetLanguage ?? "auto",
    createdAt: message.createdAt,
    clientMessageId: message.clientMessageId,
  }));
}

function toMessageSendResult(message: {
  id: number;
  senderType: "patient" | "doctor" | "system";
  createdAt: Date;
}) {
  return {
    id: message.id,
    senderType: message.senderType,
    createdAt: message.createdAt,
  };
}

export const visitRouter = router({
  roomGetMessages: publicProcedure
    .input(roomGetMessagesInputSchema)
    .output(
      z.object({
        appointmentId: z.number().int().positive(),
        role: z.enum(["patient", "doctor"]),
        messages: z.array(messageSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      const validated = await validateAppointmentAccessToken({
        token: input.token,
        action: "read_history",
        req: ctx.req,
      });
      const appointment = validated.appointment;
      const touchedAt = new Date();
      if (validated.role === "doctor") {
        await appointmentsRepo.updateAppointmentById(appointment.id, {
          doctorLastAccessAt: touchedAt,
        });
      } else {
        await appointmentsRepo.updateAppointmentById(appointment.id, {
          lastAccessAt: touchedAt,
        });
      }

      const cursor =
        typeof input.beforeCursor === "string" && input.beforeCursor.trim().length > 0
          ? decodeCursor(input.beforeCursor)
          : null;

      const pageRows = cursor
        ? await visitRepo.getMessagesBeforeCursor({
            appointmentId: appointment.id,
            beforeCreatedAt: cursor.createdAt,
            beforeId: cursor.id,
            limit: input.limit,
          })
        : await visitRepo.getRecentMessages(appointment.id, input.limit);

      const rowCount = pageRows.length;
      const oldestDesc = rowCount > 0 ? pageRows[rowCount - 1] : null;
      const orderedAsc = pageRows.reverse();
      const normalized = normalizeMessages(orderedAsc);
      const hasMore = rowCount === input.limit;

      return {
        appointmentId: appointment.id,
        role: validated.role,
        messages: normalized,
        nextCursor:
          hasMore && oldestDesc
            ? encodeCursor(oldestDesc.createdAt, oldestDesc.id)
            : null,
        hasMore,
      };
    }),

  getMessagesByToken: publicProcedure
    .input(getMessagesInputSchema)
    .output(
      z.object({
        messages: z.array(messageSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "read_history",
        ctx.req
      );

      const cursor =
        typeof input.beforeCursor === "string" && input.beforeCursor.trim().length > 0
          ? decodeCursor(input.beforeCursor)
          : null;

      const pageRows = cursor
        ? await visitRepo.getMessagesBeforeCursor({
            appointmentId: appointment.id,
            beforeCreatedAt: cursor.createdAt,
            beforeId: cursor.id,
            limit: input.limit,
          })
        : await visitRepo.getRecentMessages(appointment.id, input.limit);

      const rowCount = pageRows.length;
      const oldestDesc = rowCount > 0 ? pageRows[rowCount - 1] : null;
      const orderedAsc = pageRows.reverse();
      const normalized = normalizeMessages(orderedAsc);
      const hasMore = rowCount === input.limit;

      return {
        messages: normalized,
        nextCursor:
          hasMore && oldestDesc
            ? encodeCursor(oldestDesc.createdAt, oldestDesc.id)
            : null,
        hasMore,
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
    .mutation(async ({ input, ctx }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "send_message",
        ctx.req
      );

      const dedupeClientMessageId = input.clientMessageId ?? input.clientMsgId;

      if (dedupeClientMessageId) {
        const existing = await visitRepo.getMessageByClientMessageId(
          appointment.id,
          dedupeClientMessageId
        );

        if (existing) {
          return toMessageSendResult(existing);
        }
      }

      const translation = await translateVisitMessage({
        content: input.content,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      });

      const createdAt = new Date();
      const senderType = role === "doctor" ? "doctor" : "patient";
      const messageUserId =
        role === "patient" ? (appointment.userId ?? null) : null;
      const getMysqlErrorCode = (error: unknown) =>
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;
      const isDuplicate = (error: unknown) =>
        getMysqlErrorCode(error) === "ER_DUP_ENTRY";
      const isFkViolation = (error: unknown) =>
        getMysqlErrorCode(error) === "ER_NO_REFERENCED_ROW_2";

      const insertOnce = (userId: number | null) =>
        visitRepo.createMessage({
          appointmentId: appointment.id,
          userId,
          senderType,
          content: translation.translatedContent,
          originalContent: translation.originalContent,
          translatedContent: translation.translatedContent,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          translationProvider: translation.translationProvider,
          createdAt,
          clientMessageId: dedupeClientMessageId,
        });

      let insertResult: unknown;
      try {
        insertResult = await insertOnce(messageUserId);
      } catch (error) {
        if (messageUserId !== null && isFkViolation(error)) {
          try {
            insertResult = await insertOnce(null);
          } catch (retryError) {
            if (dedupeClientMessageId && isDuplicate(retryError)) {
              const existing = await visitRepo.getMessageByClientMessageId(
                appointment.id,
                dedupeClientMessageId
              );

              if (existing) {
                return toMessageSendResult(existing);
              }
            }

            throw retryError;
          }
        } else if (dedupeClientMessageId && isDuplicate(error)) {
          const existing = await visitRepo.getMessageByClientMessageId(
            appointment.id,
            dedupeClientMessageId
          );

          if (existing) {
            return toMessageSendResult(existing);
          }

          throw error;
        } else {
          throw error;
        }
      }

      await markInSessionIfTransitioned(appointment.id);

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
    .query(async ({ input, ctx }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "read_history",
        ctx.req
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
