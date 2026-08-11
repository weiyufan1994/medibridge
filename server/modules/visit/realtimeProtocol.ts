import crypto from "crypto";
import type { IncomingMessage } from "http";
import type net from "net";
import type { AppointmentMessage } from "../../../drizzle/schema";

export type VisitRole = "patient" | "doctor";

export type RoomConnection = {
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

export type ClientEnvelope =
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

export function encodeCursor(createdAt: Date, id: number) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url"
  );
}

export function toWireMessage(message: AppointmentMessage) {
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

export function jsonToTextFrame(payload: unknown) {
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

export function pingFrame() {
  return Buffer.from([0x89, 0x00]);
}

export function closeFrame() {
  return Buffer.from([0x88, 0x00]);
}

export function acceptWebSocket(req: IncomingMessage) {
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

export function parseFrames(buffer: Buffer) {
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
    const payload = Buffer.from(
      buffer.subarray(payloadStart, payloadStart + payloadLength)
    );

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

export function getReqIp(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? null;
}

export function getReqUserAgent(req: IncomingMessage) {
  const raw = req.headers["user-agent"];
  if (typeof raw === "string") {
    return raw;
  }
  return null;
}

export function asErrorCode(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "INTERNAL_SERVER_ERROR";
}
