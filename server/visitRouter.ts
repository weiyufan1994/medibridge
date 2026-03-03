import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointmentMessages } from "../drizzle/schema";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as visitRepo from "./modules/visit/repo";
import { validateAppointmentToken } from "./appointmentsRouter";
import { publicProcedure, router } from "./_core/trpc";

const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

const getMessagesInputSchema = accessInputSchema.extend({
  limit: z.number().int().min(1).max(200).optional().default(50),
  beforeCursor: z.string().trim().min(1).optional(),
});

const sendMessageInputSchema = accessInputSchema.extend({
  content: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
  targetLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
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
  clientMsgId: z.string().nullable(),
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
    clientMsgId: message.clientMsgId,
  }));
}

function translateMessage(input: {
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
}) {
  const originalContent = input.content;

  // Placeholder translation seam. When translator is wired,
  // replace this with real translation call and keep both fields persisted.
  const translatedContent = input.content;

  return {
    originalContent,
    translatedContent,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    translationProvider: "identity",
  };
}

async function markInSessionIfTransitioned(appointmentId: number) {
  try {
    const fromStatus = await appointmentsRepo.markAppointmentInSessionIfNeeded(
      appointmentId
    );
    if (!fromStatus) {
      return;
    }

    await appointmentsRepo.insertStatusEvent({
      appointmentId,
      fromStatus,
      toStatus: "in_session",
      operatorType: "system",
      reason: "first_visit_message",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Visit] failed to mark in_session:", error);
    }
  }
}

export const visitRouter = router({
  getMessagesByToken: publicProcedure
    .input(getMessagesInputSchema)
    .output(
      z.object({
        messages: z.array(messageSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "read_history"
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

      const orderedAsc = pageRows.reverse();
      const normalized = normalizeMessages(orderedAsc);
      const oldest = pageRows[pageRows.length - 1];

      return {
        messages: normalized,
        nextCursor: oldest ? encodeCursor(oldest.createdAt, oldest.id) : null,
        hasMore: pageRows.length === input.limit,
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
        input.token,
        "send_message"
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

      const translation = translateMessage({
        content: input.content,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      });

      const createdAt = new Date();
      const senderType = role === "doctor" ? "doctor" : "patient";
      const messageUserId =
        role === "patient" ? (appointment.userId ?? null) : null;
      let insertResult: unknown;
      try {
        insertResult = await visitRepo.createMessage({
          appointmentId: appointment.id,
          userId: messageUserId,
          senderType,
          content: translation.translatedContent,
          originalContent: translation.originalContent,
          translatedContent: translation.translatedContent,
          sourceLanguage: translation.sourceLanguage,
          targetLanguage: translation.targetLanguage,
          translationProvider: translation.translationProvider,
          createdAt,
          clientMsgId: input.clientMsgId,
        });
      } catch (error) {
        const errorCode =
          (error as { cause?: { code?: string } })?.cause?.code ??
          (error as { code?: string })?.code;

        if (messageUserId && errorCode === "ER_NO_REFERENCED_ROW_2") {
          insertResult = await visitRepo.createMessage({
            appointmentId: appointment.id,
            userId: null,
            senderType,
            content: translation.translatedContent,
            originalContent: translation.originalContent,
            translatedContent: translation.translatedContent,
            sourceLanguage: translation.sourceLanguage,
            targetLanguage: translation.targetLanguage,
            translationProvider: translation.translationProvider,
            createdAt,
            clientMsgId: input.clientMsgId,
          });
        } else {
        const duplicateCode =
          (error as { cause?: { code?: string } })?.cause?.code ??
          (error as { code?: string })?.code;
        if (input.clientMsgId && duplicateCode === "ER_DUP_ENTRY") {
          const existing = await visitRepo.getMessageByClientMsgId(
            appointment.id,
            input.clientMsgId
          );
          if (existing) {
            return existing;
          }
        }
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
    .query(async ({ input }) => {
      const { appointment } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "read_history"
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
