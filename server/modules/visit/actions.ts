import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { isDuplicateDbError, isForeignKeyDbError } from "../../_core/dbCompat";
import * as appointmentsRepo from "../appointments/repo";
import { appointmentCore } from "../appointments/routerApi";
import { validateAppointmentAccessToken } from "../appointments/tokenValidation";
import * as visitRepo from "./repo";
import type {
  GetMessagesInput,
  PollMessagesInput,
  RoomGetMessagesInput,
  SendMessageInput,
  SendMessageOutput,
} from "./schemas";
import { markInSessionIfTransitioned } from "./status";
import { translateVisitMessage } from "./translation";

type VisitMessageRow = Awaited<ReturnType<typeof visitRepo.getRecentMessages>>[number];

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

function normalizeMessages(messages: VisitMessageRow[]) {
  return messages.map(message => ({
    id: message.id,
    senderType: message.senderType,
    content: message.content,
    originalContent: message.originalContent ?? message.content ?? "",
    translatedContent: message.translatedContent ?? message.content ?? "",
    sourceLanguage: message.sourceLanguage ?? "auto",
    targetLanguage: message.targetLanguage ?? "auto",
    createdAt: message.createdAt,
    clientMessageId: message.clientMessageId,
  }));
}

function toMessageSendResult(message: {
  id: number;
  senderType: unknown;
  createdAt: Date;
}): SendMessageOutput {
  return {
    id: message.id,
    senderType: toMessageSenderType(message.senderType),
    createdAt: message.createdAt,
  };
}

function readInsertedMessage(input: Awaited<ReturnType<typeof visitRepo.createMessage>>) {
  const insertedId = Number(
    (input as { id?: number })?.id ??
      (input as { insertId?: number })?.insertId ??
      Number.NaN
  );

  if (!Number.isInteger(insertedId) || insertedId <= 0) {
    return null;
  }

  return {
    id: insertedId,
    senderType: (input as { senderType?: unknown })?.senderType ?? "patient",
    createdAt:
      (input as { createdAt?: Date })?.createdAt instanceof Date
        ? ((input as { createdAt?: Date }).createdAt as Date)
        : new Date(),
  };
}

function toMessageSenderType(value: unknown): "patient" | "doctor" | "system" {
  if (value === "patient" || value === "doctor" || value === "system") {
    return value;
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Invalid sender type in persisted message",
  });
}

export async function roomGetMessagesByToken(input: RoomGetMessagesInput, req?: Request) {
  const validated = await validateAppointmentAccessToken({
    token: input.token,
    action: "read_history",
    req,
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
      hasMore && oldestDesc ? encodeCursor(oldestDesc.createdAt, oldestDesc.id) : null,
    hasMore,
  };
}

export async function getMessagesByToken(input: GetMessagesInput, req?: Request) {
  const { appointment } = await appointmentCore.validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    req
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
      hasMore && oldestDesc ? encodeCursor(oldestDesc.createdAt, oldestDesc.id) : null,
    hasMore,
  };
}

export async function sendMessageByToken(
  input: SendMessageInput,
  req?: Request
): Promise<SendMessageOutput> {
  const { appointment, role } = await appointmentCore.validateAppointmentToken(
    input.appointmentId,
    input.token,
    "send_message",
    req
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
  const messageUserId = role === "patient" ? (appointment.userId ?? null) : null;
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

  let insertedMessage: Awaited<ReturnType<typeof visitRepo.createMessage>>;
  try {
    insertedMessage = await insertOnce(messageUserId);
  } catch (error) {
    if (messageUserId !== null && isForeignKeyDbError(error)) {
      try {
        insertedMessage = await insertOnce(null);
      } catch (retryError) {
        if (dedupeClientMessageId && isDuplicateDbError(retryError)) {
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
    } else if (dedupeClientMessageId && isDuplicateDbError(error)) {
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

  const inserted = readInsertedMessage(insertedMessage);
  if (inserted) {
    return toMessageSendResult(inserted);
  }

  const latest = await visitRepo.getLatestMessage(appointment.id);
  if (!latest) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve inserted message",
    });
  }

  return toMessageSendResult({
    id: latest.id,
    senderType: latest.senderType,
    createdAt: latest.createdAt,
  });
}

export async function pollNewMessagesByToken(input: PollMessagesInput, req?: Request) {
  const { appointment } = await appointmentCore.validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    req
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
}
