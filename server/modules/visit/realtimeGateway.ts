import crypto from "crypto";
import type { IncomingMessage } from "http";
import type net from "net";
import type { Duplex } from "stream";
import type { AppointmentMessage } from "../../../drizzle/schema";
import * as appointmentsRepo from "../appointments/repo";
import { canJoinRoom, canSendMessage } from "../appointments/chatPolicy";
import { resolveConsultationTimerState } from "../appointments/consultationTimer";
import { extendConsultationByDoctorTokenFlow } from "../appointments/timerActions";
import { validateAppointmentAccessToken } from "../appointments/tokenValidation";
import * as visitRepo from "./repo";
import { markInSessionIfTransitioned } from "./status";
import { translateVisitMessage } from "./translation";

type VisitRole = "patient" | "doctor";
type VisitSender = "patient" | "doctor" | "system";

type RoomConnection = {
  id: string;
  socket: net.Socket;
  buffer: Buffer;
  isClosed: boolean;
  token: string | null;
  appointmentId: number | null;
  role: VisitRole | null;
  status: string | null;
  canSendMessage: boolean;
  lastPongAtMs: number;
  heartbeatTimer: NodeJS.Timeout | null;
  statusTimer: NodeJS.Timeout | null;
};

type ClientEnvelope =
  | { event: "room.join"; data?: { token?: string } }
  | {
      event: "message.send";
      data?: {
        textOriginal?: string;
        clientMessageId?: string;
        targetLanguage?: string;
      };
    }
  | {
      event: "room.timer.extend";
      data?: { requestId?: string; minutes?: number };
    };

function encodeCursor(createdAt: Date, id: number) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function toWireMessage(message: AppointmentMessage) {
  return {
    id: message.id,
    appointmentId: message.appointmentId,
    senderRole: message.senderType,
    textOriginal: message.originalContent ?? message.content ?? "",
    textTranslated: message.translatedContent ?? message.content ?? "",
    sourceLanguage: message.sourceLanguage ?? "auto",
    targetLanguage: message.targetLanguage ?? "auto",
    clientMessageId: message.clientMessageId ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

function jsonToTextFrame(payload: unknown) {
  const text = JSON.stringify(payload);
  const body = Buffer.from(text, "utf8");
  const header =
    body.length < 126
      ? Buffer.from([0x81, body.length])
      : body.length < 65536
        ? Buffer.from([0x81, 126, (body.length >> 8) & 255, body.length & 255])
        : null;

  if (header) {
    return Buffer.concat([header, body]);
  }

  const longHeader = Buffer.alloc(10);
  longHeader[0] = 0x81;
  longHeader[1] = 127;
  longHeader.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([longHeader, body]);
}

function pingFrame() {
  return Buffer.from([0x89, 0x00]);
}

function closeFrame() {
  return Buffer.from([0x88, 0x00]);
}

function acceptWebSocket(req: IncomingMessage) {
  const key = req.headers["sec-websocket-key"];
  const upgrade = req.headers.upgrade;
  const connection = req.headers.connection;
  const version = req.headers["sec-websocket-version"];

  if (
    typeof key !== "string" ||
    typeof upgrade !== "string" ||
    typeof connection !== "string" ||
    version !== "13"
  ) {
    return null;
  }

  if (upgrade.toLowerCase() !== "websocket") {
    return null;
  }
  if (!connection.toLowerCase().includes("upgrade")) {
    return null;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  return [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n",
  ].join("\r\n");
}

function parseFrames(buffer: Buffer) {
  const frames: Array<{ opcode: number; payload: Buffer }> = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let payloadLength = second & 0x7f;
    let cursor = offset + 2;

    if (payloadLength === 126) {
      if (cursor + 2 > buffer.length) {
        break;
      }
      payloadLength = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (payloadLength === 127) {
      if (cursor + 8 > buffer.length) {
        break;
      }
      const longLength = Number(buffer.readBigUInt64BE(cursor));
      if (!Number.isSafeInteger(longLength)) {
        throw new Error("Unsupported frame length");
      }
      payloadLength = longLength;
      cursor += 8;
    }

    const maskBytes = masked ? 4 : 0;
    const frameLength = cursor + maskBytes + payloadLength;
    if (frameLength > buffer.length) {
      break;
    }

    const payloadStart = cursor + maskBytes;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLength));

    if (masked) {
      const mask = buffer.subarray(cursor, cursor + 4);
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] = payload[i] ^ mask[i % 4];
      }
    }

    frames.push({ opcode, payload });
    offset = frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

function getReqIp(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? null;
}

function getReqUserAgent(req: IncomingMessage) {
  const raw = req.headers["user-agent"];
  if (typeof raw === "string") {
    return raw;
  }
  return null;
}

function asErrorCode(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "INTERNAL_SERVER_ERROR";
}

function toRoomTimerPayload(notes: string | null | undefined) {
  const timer = resolveConsultationTimerState(notes);
  return {
    baseDurationMinutes: timer.baseDurationMinutes,
    extensionMinutes: timer.extensionMinutes,
    totalDurationMinutes: timer.totalDurationMinutes,
  };
}

export function createVisitRealtimeGateway() {
  const rooms = new Map<number, Set<RoomConnection>>();
  const connections = new Set<RoomConnection>();

  function sendEvent(connection: RoomConnection, event: string, data: unknown) {
    if (connection.isClosed) {
      return;
    }
    connection.socket.write(jsonToTextFrame({ event, data }));
  }

  function sendError(connection: RoomConnection, code: string, detail?: string) {
    sendEvent(connection, "error", {
      code,
      message: detail ?? code,
    });
  }

  function removeFromRoom(connection: RoomConnection) {
    if (!connection.appointmentId) {
      return;
    }
    const room = rooms.get(connection.appointmentId);
    if (!room) {
      return;
    }
    room.delete(connection);
    if (room.size === 0) {
      rooms.delete(connection.appointmentId);
    }
  }

  function closeConnection(connection: RoomConnection) {
    if (connection.isClosed) {
      return;
    }
    connection.isClosed = true;
    if (connection.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer);
    }
    if (connection.statusTimer) {
      clearInterval(connection.statusTimer);
    }
    removeFromRoom(connection);
    connections.delete(connection);
    try {
      connection.socket.write(closeFrame());
    } catch {
      // ignore
    }
    connection.socket.destroy();
  }

  function broadcastRoom(appointmentId: number, event: string, data: unknown) {
    const room = rooms.get(appointmentId);
    if (!room || room.size === 0) {
      return;
    }
    room.forEach(connection => {
      sendEvent(connection, event, data);
    });
  }

  async function pushRoomStatus(input: {
    connection: RoomConnection;
    appointmentId: number;
    role: VisitRole;
    status: string;
    paymentStatus: string;
  }) {
    const canSend = canSendMessage({
      status: input.status,
      paymentStatus: input.paymentStatus,
    });
    input.connection.status = input.status;
    input.connection.canSendMessage = canSend;
    broadcastRoom(input.appointmentId, "room.status", {
      appointmentId: input.appointmentId,
      role: input.role,
      currentStatus: input.status,
      canSendMessage: canSend,
    });
  }

  async function handleRoomJoin(connection: RoomConnection, req: IncomingMessage, token: string) {
    const validated = await validateAppointmentAccessToken({
      token,
      action: "join_room",
      req: req as never,
    });
    const appointment = validated.appointment;
    const role = validated.role;
    const appointmentId = appointment.id;
    if (
      !canJoinRoom({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      })
    ) {
      sendError(connection, "APPOINTMENT_NOT_ALLOWED");
      return;
    }
    const canSend = canSendMessage({
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
    });
    const latestCursorRow = await visitRepo.getLatestMessageCursor(appointmentId);
    const recentCursor = latestCursorRow
      ? encodeCursor(latestCursorRow.createdAt, latestCursorRow.id)
      : null;

    removeFromRoom(connection);
    connection.token = token;
    connection.appointmentId = appointmentId;
    connection.role = role;
    connection.status = appointment.status;
    connection.canSendMessage = canSend;

    let room = rooms.get(appointmentId);
    if (!room) {
      room = new Set<RoomConnection>();
      rooms.set(appointmentId, room);
    }
    room.add(connection);

    sendEvent(connection, "room.joined", {
      appointmentId,
      role,
      currentStatus: appointment.status,
      canSendMessage: canSend,
      recentCursor,
    });
    sendEvent(connection, "room.timer", toRoomTimerPayload(appointment.notes));
  }

  async function handleMessageSend(
    connection: RoomConnection,
    req: IncomingMessage,
    payload: { textOriginal?: string; clientMessageId?: string; targetLanguage?: string }
  ) {
    const appointmentId = connection.appointmentId;
    const role = connection.role;
    const token = connection.token;
    if (!appointmentId || !role || !token) {
      sendError(connection, "ROOM_NOT_JOINED");
      return;
    }

    const textOriginal = (payload.textOriginal ?? "").trim();
    const clientMessageId = (payload.clientMessageId ?? "").trim();
    if (!textOriginal || !clientMessageId) {
      sendError(connection, "BAD_REQUEST", "textOriginal and clientMessageId are required");
      return;
    }
    if (textOriginal.length > 4000 || clientMessageId.length > 128) {
      sendError(connection, "BAD_REQUEST", "message payload too large");
      return;
    }

    const validated = await validateAppointmentAccessToken({
      token,
      action: "send_message",
      expectedAppointmentId: appointmentId,
      req: req as never,
    });
    const appointment = validated.appointment;
    if (
      !canSendMessage({
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
      sendError(connection, "APPOINTMENT_NOT_ALLOWED");
      return;
    }

    let messageRow: AppointmentMessage | null = null;
    const senderType: VisitSender = role === "doctor" ? "doctor" : "patient";
    const messageUserId = role === "patient" ? (appointment.userId ?? null) : null;
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
      sendError(connection, "INTERNAL_SERVER_ERROR", (error as Error).message || "translation failed");
      return;
    }

    try {
      const insertResult = await visitRepo.createMessage({
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
      const insertId = Number(
        (insertResult as { insertId?: number })?.insertId ??
          (Array.isArray(insertResult)
            ? (insertResult[0] as { insertId?: number } | undefined)?.insertId
            : NaN)
      );
      if (Number.isInteger(insertId) && insertId > 0) {
        messageRow = await visitRepo.getMessageById(insertId);
      }
    } catch (error) {
      const mysqlCode =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;
      if (mysqlCode === "ER_DUP_ENTRY") {
        messageRow = await visitRepo.getMessageByClientMessageId(appointmentId, clientMessageId);
      } else if (mysqlCode === "ER_NO_REFERENCED_ROW_2") {
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
        const retryInsertId = Number(
          (retryInsertResult as { insertId?: number })?.insertId ??
            (Array.isArray(retryInsertResult)
              ? (retryInsertResult[0] as { insertId?: number } | undefined)?.insertId
              : NaN)
        );
        if (Number.isInteger(retryInsertId) && retryInsertId > 0) {
          messageRow = await visitRepo.getMessageById(retryInsertId);
        }
      } else {
        throw error;
      }
    }

    await markInSessionIfTransitioned(appointmentId);

    if (!messageRow) {
      sendError(connection, "INTERNAL_SERVER_ERROR", "failed to resolve message row");
      return;
    }

    broadcastRoom(appointmentId, "message.new", toWireMessage(messageRow));
  }

  async function handleTimerExtend(
    connection: RoomConnection,
    req: IncomingMessage,
    payload: { requestId?: string; minutes?: number }
  ) {
    const appointmentId = connection.appointmentId;
    const token = connection.token;
    if (!appointmentId || !token) {
      sendError(connection, "ROOM_NOT_JOINED");
      return;
    }

    const requestId = (payload.requestId ?? "").trim();
    if (!requestId || requestId.length > 128) {
      sendError(connection, "BAD_REQUEST", "requestId is required");
      return;
    }

    const minutes = Number(payload.minutes);
    if (!Number.isInteger(minutes)) {
      sendError(connection, "BAD_REQUEST", "minutes must be integer");
      return;
    }

    const extended = await extendConsultationByDoctorTokenFlow({
      appointmentId,
      token,
      extensionMinutes: minutes,
      req: req as never,
    });

    broadcastRoom(appointmentId, "room.timer", {
      baseDurationMinutes: extended.baseDurationMinutes,
      extensionMinutes: extended.extensionMinutes,
      totalDurationMinutes: extended.totalDurationMinutes,
    });
  }

  function startConnectionTimers(connection: RoomConnection, req: IncomingMessage) {
    connection.heartbeatTimer = setInterval(() => {
      if (connection.isClosed) {
        return;
      }
      const now = Date.now();
      if (now - connection.lastPongAtMs > 60_000) {
        closeConnection(connection);
        return;
      }
      try {
        connection.socket.write(pingFrame());
      } catch {
        closeConnection(connection);
      }
    }, 25_000);

    connection.statusTimer = setInterval(async () => {
      if (connection.isClosed || !connection.appointmentId || !connection.role) {
        return;
      }
      const appointment = await appointmentsRepo.getAppointmentById(connection.appointmentId);
      if (!appointment) {
        closeConnection(connection);
        return;
      }
      const nextCanSend = canSendMessage({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      });
      if (appointment.status !== connection.status || nextCanSend !== connection.canSendMessage) {
        await pushRoomStatus({
          connection,
          appointmentId: appointment.id,
          role: connection.role,
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
        });
      }
      if (
        !canJoinRoom({
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
        })
      ) {
        sendEvent(connection, "error", {
          code: "ROOM_READ_ONLY",
          message: "room is now read-only",
        });
      }
    }, 10_000);

    connection.socket.on("close", () => closeConnection(connection));
    connection.socket.on("end", () => closeConnection(connection));
    connection.socket.on("error", () => closeConnection(connection));
    connection.socket.on("data", chunk => {
      if (connection.isClosed) {
        return;
      }

      try {
        connection.buffer = Buffer.concat([connection.buffer, chunk]);
        const parsed = parseFrames(connection.buffer);
        connection.buffer = parsed.remaining;

        for (const frame of parsed.frames) {
          if (frame.opcode === 0x8) {
            closeConnection(connection);
            return;
          }
          if (frame.opcode === 0x9) {
            connection.socket.write(Buffer.from([0x8a, 0x00]));
            continue;
          }
          if (frame.opcode === 0xa) {
            connection.lastPongAtMs = Date.now();
            continue;
          }
          if (frame.opcode !== 0x1) {
            continue;
          }

          const raw = frame.payload.toString("utf8");
          let envelope: ClientEnvelope | null = null;
          try {
            envelope = JSON.parse(raw) as ClientEnvelope;
          } catch {
            sendError(connection, "BAD_REQUEST", "invalid JSON payload");
            continue;
          }

          if (!envelope || typeof envelope !== "object") {
            sendError(connection, "BAD_REQUEST");
            continue;
          }

          if (envelope.event === "room.join") {
            const nextToken = (envelope.data?.token ?? "").trim();
            if (!nextToken) {
              sendError(connection, "BAD_REQUEST", "token is required");
              continue;
            }
            void handleRoomJoin(connection, req, nextToken).catch(error => {
              sendError(connection, asErrorCode(error));
            });
            continue;
          }

          if (envelope.event === "message.send") {
            void handleMessageSend(connection, req, envelope.data ?? {}).catch(error => {
              sendError(connection, asErrorCode(error));
            });
            continue;
          }

          if (envelope.event === "room.timer.extend") {
            void handleTimerExtend(connection, req, envelope.data ?? {}).catch(error => {
              sendError(connection, asErrorCode(error));
            });
            continue;
          }

          sendError(connection, "BAD_REQUEST", "unsupported event");
        }
      } catch (error) {
        sendError(connection, "BAD_REQUEST", asErrorCode(error));
        closeConnection(connection);
      }
    });
  }

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/api/visit-room/ws") {
      return false;
    }

    const response = acceptWebSocket(req);
    if (!response) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return true;
    }

    socket.write(response);
    if (head && head.length > 0) {
      socket.unshift(head);
    }
    const networkSocket = socket as net.Socket;
    networkSocket.setKeepAlive(true);
    networkSocket.setNoDelay(true);

    const connection: RoomConnection = {
      id: crypto.randomUUID(),
      socket: networkSocket,
      buffer: Buffer.alloc(0),
      isClosed: false,
      token: null,
      appointmentId: null,
      role: null,
      status: null,
      canSendMessage: false,
      lastPongAtMs: Date.now(),
      heartbeatTimer: null,
      statusTimer: null,
    };
    connections.add(connection);

    if (process.env.NODE_ENV !== "test") {
      console.info("[VisitRealtime] client connected", {
        connectionId: connection.id,
        ip: getReqIp(req),
        userAgent: getReqUserAgent(req),
      });
    }

    startConnectionTimers(connection, req);
    return true;
  }

  function shutdown() {
    for (const connection of Array.from(connections)) {
      closeConnection(connection);
    }
    rooms.clear();
  }

  return {
    handleUpgrade,
    shutdown,
  };
}
