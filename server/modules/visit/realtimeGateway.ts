import crypto from "crypto";
import type { RequestMetadata } from "@shared/requestMetadata";
import type { IncomingMessage } from "http";
import type net from "net";
import type { Duplex } from "stream";
import { createLogger } from "../../_core/logger";
import { appointmentVisitApi } from "../appointments/publicApi";
import { createVisitRealtimeEventHandlers } from "./realtimeEventHandlers";
import {
  acceptWebSocket,
  asErrorCode,
  closeFrame,
  getReqIp,
  getReqUserAgent,
  jsonToTextFrame,
  parseFrames,
  pingFrame,
  type ClientEnvelope,
  type RoomConnection,
} from "./realtimeProtocol";

const logger = createLogger("visit-realtime");

export function createVisitRealtimeGateway() {
  const rooms = new Map<number, Set<RoomConnection>>();
  const connections = new Set<RoomConnection>();

  function getRealtimeRequestMetadata(req: IncomingMessage): RequestMetadata {
    return {
      clientIp: getReqIp(req),
      forwardedHost: null,
      forwardedProto: null,
      host: null,
      protocol: null,
      requestId: null,
      userAgent: getReqUserAgent(req),
    };
  }

  function sendEvent(connection: RoomConnection, event: string, data: unknown) {
    if (connection.isClosed) {
      return;
    }
    connection.socket.write(jsonToTextFrame({ event, data }));
  }

  function sendError(
    connection: RoomConnection,
    code: string,
    detail?: string
  ) {
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

  function addToRoom(appointmentId: number, connection: RoomConnection) {
    let room = rooms.get(appointmentId);
    if (!room) {
      room = new Set<RoomConnection>();
      rooms.set(appointmentId, room);
    }
    room.add(connection);
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

  const {
    handleMessageSend,
    handleRoomJoin,
    handleTimerExtend,
    pushRoomStatus,
  } = createVisitRealtimeEventHandlers({
    addToRoom,
    broadcastRoom,
    removeFromRoom,
    sendError,
    sendEvent,
  });

  function startConnectionTimers(
    connection: RoomConnection,
    req: IncomingMessage
  ) {
    const requestMetadata = getRealtimeRequestMetadata(req);
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
      if (
        connection.isClosed ||
        !connection.appointmentId ||
        !connection.role ||
        !connection.token
      ) {
        return;
      }
      let appointment: Awaited<
        ReturnType<typeof appointmentVisitApi.validateAccessToken>
      >["appointment"];
      try {
        const validated = await appointmentVisitApi.validateAccessToken({
          token: connection.token,
          action: "read_history",
          expectedAppointmentId: connection.appointmentId,
          expectedRole: connection.role,
          requestMetadata,
        });
        appointment = validated.appointment;
      } catch (error) {
        sendError(connection, asErrorCode(error));
        closeConnection(connection);
        return;
      }
      const nextCanSend = appointmentVisitApi.canSendMessage({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      });
      if (
        appointment.status !== connection.status ||
        nextCanSend !== connection.canSendMessage
      ) {
        await pushRoomStatus({
          connection,
          appointmentId: appointment.id,
          role: connection.role,
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
        });
      }
      if (
        !appointmentVisitApi.canJoinRoom({
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
            void handleRoomJoin(connection, requestMetadata, nextToken).catch(
              error => {
                sendError(connection, asErrorCode(error));
              }
            );
            continue;
          }

          if (envelope.event === "message.send") {
            void handleMessageSend(
              connection,
              requestMetadata,
              envelope.data ?? {}
            ).catch(error => {
              sendError(connection, asErrorCode(error));
            });
            continue;
          }

          if (envelope.event === "room.timer.extend") {
            void handleTimerExtend(
              connection,
              requestMetadata,
              envelope.data ?? {}
            ).catch(error => {
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
      logger.info("client_connected", {
        connectionId: connection.id,
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
