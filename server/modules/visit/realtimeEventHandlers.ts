import type { IncomingMessage } from "http";
import type { AppointmentMessage } from "../../../drizzle/schema";
import { isDuplicateDbError, isForeignKeyDbError } from "../../_core/dbCompat";
import { appointmentVisitApi } from "../appointments/publicApi";
import {
  encodeCursor,
  toWireMessage,
  type RoomConnection,
  type VisitRole,
} from "./realtimeProtocol";
import * as visitRepo from "./repo";
import { translateVisitMessage } from "./translation";

type VisitSender = "patient" | "doctor" | "system";

type RealtimeEventCallbacks = {
  sendEvent(connection: RoomConnection, event: string, data: unknown): void;
  sendError(connection: RoomConnection, code: string, detail?: string): void;
  removeFromRoom(connection: RoomConnection): void;
  broadcastRoom(appointmentId: number, event: string, data: unknown): void;
  addToRoom(appointmentId: number, connection: RoomConnection): void;
};

function toRoomTimerPayload(notes: string | null | undefined) {
  const timer = appointmentVisitApi.resolveConsultationTimerState(notes);
  return {
    baseDurationMinutes: timer.baseDurationMinutes,
    extensionMinutes: timer.extensionMinutes,
    totalDurationMinutes: timer.totalDurationMinutes,
  };
}

function getInsertedMessageId(
  result: Awaited<ReturnType<typeof visitRepo.createMessage>>
) {
  const insertedId = Number(
    (result as { id?: number })?.id ??
      (result as { insertId?: number })?.insertId ??
      Number.NaN
  );

  return Number.isInteger(insertedId) && insertedId > 0 ? insertedId : null;
}

export function createVisitRealtimeEventHandlers(
  callbacks: RealtimeEventCallbacks
) {
  async function pushRoomStatus(input: {
    connection: RoomConnection;
    appointmentId: number;
    role: VisitRole;
    status: string;
    paymentStatus: string;
  }) {
    const canSend = appointmentVisitApi.canSendMessage({
      status: input.status,
      paymentStatus: input.paymentStatus,
    });
    input.connection.status = input.status;
    input.connection.canSendMessage = canSend;
    callbacks.broadcastRoom(input.appointmentId, "room.status", {
      appointmentId: input.appointmentId,
      role: input.role,
      currentStatus: input.status,
      canSendMessage: canSend,
    });
  }

  async function handleRoomJoin(
    connection: RoomConnection,
    req: IncomingMessage,
    token: string
  ) {
    const validated = await appointmentVisitApi.validateAccessToken({
      token,
      action: "join_room",
      req: req as never,
    });
    const appointment = validated.appointment;
    const role = validated.role;
    const appointmentId = appointment.id;
    if (
      !appointmentVisitApi.canJoinRoom({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      })
    ) {
      callbacks.sendError(connection, "APPOINTMENT_NOT_ALLOWED");
      return;
    }
    const canSend = appointmentVisitApi.canSendMessage({
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
    });
    const latestCursorRow =
      await visitRepo.getLatestMessageCursor(appointmentId);
    const recentCursor = latestCursorRow
      ? encodeCursor(latestCursorRow.createdAt, latestCursorRow.id)
      : null;

    callbacks.removeFromRoom(connection);
    connection.token = token;
    connection.appointmentId = appointmentId;
    connection.role = role;
    connection.status = appointment.status;
    connection.canSendMessage = canSend;

    callbacks.addToRoom(appointmentId, connection);

    callbacks.sendEvent(connection, "room.joined", {
      appointmentId,
      role,
      currentStatus: appointment.status,
      canSendMessage: canSend,
      recentCursor,
    });
    callbacks.sendEvent(
      connection,
      "room.timer",
      toRoomTimerPayload(appointment.notes)
    );
  }

  async function handleMessageSend(
    connection: RoomConnection,
    req: IncomingMessage,
    payload: {
      textOriginal?: string;
      clientMessageId?: string;
      targetLanguage?: string;
    }
  ) {
    const appointmentId = connection.appointmentId;
    const role = connection.role;
    const token = connection.token;
    if (!appointmentId || !role || !token) {
      callbacks.sendError(connection, "ROOM_NOT_JOINED");
      return;
    }

    const textOriginal = (payload.textOriginal ?? "").trim();
    const clientMessageId = (payload.clientMessageId ?? "").trim();
    if (!textOriginal || !clientMessageId) {
      callbacks.sendError(
        connection,
        "BAD_REQUEST",
        "textOriginal and clientMessageId are required"
      );
      return;
    }
    if (textOriginal.length > 4000 || clientMessageId.length > 128) {
      callbacks.sendError(
        connection,
        "BAD_REQUEST",
        "message payload too large"
      );
      return;
    }

    const validated = await appointmentVisitApi.validateAccessToken({
      token,
      action: "send_message",
      expectedAppointmentId: appointmentId,
      req: req as never,
    });
    const appointment = validated.appointment;
    if (
      !appointmentVisitApi.canSendMessage({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      })
    ) {
      await pushRoomStatus({
        connection,
        appointmentId,
        role,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      });
      callbacks.sendError(connection, "APPOINTMENT_NOT_ALLOWED");
      return;
    }

    let messageRow: AppointmentMessage | null = null;
    const senderType: VisitSender = role === "doctor" ? "doctor" : "patient";
    const messageUserId =
      role === "patient" ? (appointment.userId ?? null) : null;
    const createdAt = new Date();
    let translatedMessage: Awaited<ReturnType<typeof translateVisitMessage>>;
    try {
      translatedMessage = await translateVisitMessage({
        content: textOriginal,
        sourceLanguage: "auto",
        // Force opposite-language translation regardless of client locale payload,
        // so stale clients that send same-language targets cannot disable translation.
        targetLanguage: "auto",
      });
    } catch (error) {
      callbacks.sendError(
        connection,
        "INTERNAL_SERVER_ERROR",
        (error as Error).message || "translation failed"
      );
      return;
    }

    try {
      const insertedMessage = await visitRepo.createMessage({
        appointmentId,
        userId: messageUserId,
        senderType,
        content: translatedMessage.translatedContent,
        originalContent: translatedMessage.originalContent,
        translatedContent: translatedMessage.translatedContent,
        sourceLanguage: translatedMessage.sourceLanguage,
        targetLanguage: translatedMessage.targetLanguage,
        translationProvider: translatedMessage.translationProvider,
        clientMessageId,
        createdAt,
      });
      const insertedMessageId = getInsertedMessageId(insertedMessage);
      if (insertedMessageId) {
        messageRow = await visitRepo.getMessageById(insertedMessageId);
      }
    } catch (error) {
      if (isDuplicateDbError(error)) {
        messageRow = await visitRepo.getMessageByClientMessageId(
          appointmentId,
          clientMessageId
        );
      } else if (isForeignKeyDbError(error)) {
        const retryInsertResult = await visitRepo.createMessage({
          appointmentId,
          userId: null,
          senderType,
          content: translatedMessage.translatedContent,
          originalContent: translatedMessage.originalContent,
          translatedContent: translatedMessage.translatedContent,
          sourceLanguage: translatedMessage.sourceLanguage,
          targetLanguage: translatedMessage.targetLanguage,
          translationProvider: translatedMessage.translationProvider,
          clientMessageId,
          createdAt,
        });
        const retryInsertId = getInsertedMessageId(retryInsertResult);
        if (retryInsertId) {
          messageRow = await visitRepo.getMessageById(retryInsertId);
        }
      } else {
        throw error;
      }
    }

    await appointmentVisitApi.markInSessionAfterFirstMessage(appointmentId);

    if (!messageRow) {
      callbacks.sendError(
        connection,
        "INTERNAL_SERVER_ERROR",
        "failed to resolve message row"
      );
      return;
    }

    callbacks.broadcastRoom(
      appointmentId,
      "message.new",
      toWireMessage(messageRow)
    );
  }

  async function handleTimerExtend(
    connection: RoomConnection,
    req: IncomingMessage,
    payload: { requestId?: string; minutes?: number }
  ) {
    const appointmentId = connection.appointmentId;
    const token = connection.token;
    if (!appointmentId || !token) {
      callbacks.sendError(connection, "ROOM_NOT_JOINED");
      return;
    }

    const requestId = (payload.requestId ?? "").trim();
    if (!requestId || requestId.length > 128) {
      callbacks.sendError(connection, "BAD_REQUEST", "requestId is required");
      return;
    }

    const minutes = Number(payload.minutes);
    if (!Number.isInteger(minutes)) {
      callbacks.sendError(connection, "BAD_REQUEST", "minutes must be integer");
      return;
    }

    const extended = await appointmentVisitApi.extendConsultationByDoctorToken({
      appointmentId,
      token,
      extensionMinutes: minutes,
      req: req as never,
    });

    callbacks.broadcastRoom(appointmentId, "room.timer", {
      baseDurationMinutes: extended.baseDurationMinutes,
      extensionMinutes: extended.extensionMinutes,
      totalDurationMinutes: extended.totalDurationMinutes,
    });
  }

  return {
    handleMessageSend,
    handleRoomJoin,
    handleTimerExtend,
    pushRoomStatus,
  };
}
