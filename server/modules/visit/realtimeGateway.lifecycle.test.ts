import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handlerMocks = vi.hoisted(() => ({
  callbacks: null as Record<string, (...args: never[]) => unknown> | null,
  handleMessageSend: vi.fn(),
  handleRoomJoin: vi.fn(),
  handleTimerExtend: vi.fn(),
  pushRoomStatus: vi.fn(),
}));

vi.mock("./realtimeEventHandlers", () => ({
  createVisitRealtimeEventHandlers: vi.fn(
    (callbacks: Record<string, (...args: never[]) => unknown>) => {
      handlerMocks.callbacks = callbacks;
      return {
        handleMessageSend: handlerMocks.handleMessageSend,
        handleRoomJoin: handlerMocks.handleRoomJoin,
        handleTimerExtend: handlerMocks.handleTimerExtend,
        pushRoomStatus: handlerMocks.pushRoomStatus,
      };
    }
  ),
}));

vi.mock("../appointments/publicApi", () => ({
  appointmentVisitApi: {
    canJoinRoom: vi.fn(),
    canSendMessage: vi.fn(),
    validateAccessToken: vi.fn(),
  },
}));

import { appointmentVisitApi } from "../appointments/publicApi";
import { createVisitRealtimeGateway } from "./realtimeGateway";
import { parseFrames, type RoomConnection } from "./realtimeProtocol";

class FakeSocket extends EventEmitter {
  writes: Array<string | Buffer> = [];
  unshifted: Buffer[] = [];
  destroyed = false;
  keepAlive = false;
  noDelay = false;
  failPingWrite = false;
  failCloseWrite = false;

  setKeepAlive(value: boolean) {
    this.keepAlive = value;
    return this;
  }

  setNoDelay(value: boolean) {
    this.noDelay = value;
    return this;
  }

  write(chunk: string | Buffer) {
    if (Buffer.isBuffer(chunk) && chunk[0] === 0x89 && this.failPingWrite) {
      throw new Error("ping write failed");
    }
    if (Buffer.isBuffer(chunk) && chunk[0] === 0x88 && this.failCloseWrite) {
      throw new Error("close write failed");
    }
    this.writes.push(chunk);
    return true;
  }

  unshift(chunk: Buffer) {
    this.unshifted.push(chunk);
  }

  destroy() {
    this.destroyed = true;
  }
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    headers: {
      "sec-websocket-key": "test-key",
      "sec-websocket-version": "13",
      upgrade: "websocket",
      connection: "upgrade",
      "x-forwarded-for": "198.51.100.7",
      "user-agent": "Gateway-Test/1.0",
    },
    url: "/api/visit-room/ws",
    socket: { remoteAddress: "203.0.113.8" },
    ...overrides,
  } as never;
}

function frame(opcode: number, payload = "") {
  const body = Buffer.from(payload, "utf8");
  return Buffer.concat([Buffer.from([0x80 | opcode, body.length]), body]);
}

function textFrame(payload: unknown) {
  return frame(0x1, JSON.stringify(payload));
}

function responseEvents(socket: FakeSocket) {
  return socket.writes
    .filter((write): write is Buffer => Buffer.isBuffer(write))
    .filter(write => write[0] === 0x81)
    .map(write => {
      const parsed = parseFrames(write);
      return JSON.parse(parsed.frames[0].payload.toString("utf8"));
    });
}

function connection(
  socket: FakeSocket,
  overrides: Partial<RoomConnection> = {}
) {
  return {
    socket,
    isClosed: false,
    appointmentId: null,
    ...overrides,
  } as RoomConnection;
}

describe("visit realtime gateway lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMocks.callbacks = null;
    handlerMocks.handleMessageSend.mockResolvedValue(undefined);
    handlerMocks.handleTimerExtend.mockResolvedValue(undefined);
    handlerMocks.pushRoomStatus.mockResolvedValue(undefined);
    handlerMocks.handleRoomJoin.mockImplementation(
      async (roomConnection: RoomConnection, _metadata, token: string) => {
        roomConnection.token = token;
        roomConnection.appointmentId = 9001;
        roomConnection.role = "patient";
        roomConnection.status = "active";
        roomConnection.canSendMessage = true;
        handlerMocks.callbacks?.addToRoom?.(
          9001 as never,
          roomConnection as never
        );
      }
    );
    vi.mocked(appointmentVisitApi.canJoinRoom).mockReturnValue(true);
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(true);
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      appointment: {
        id: 9001,
        status: "active",
        paymentStatus: "paid",
      },
      role: "patient",
    } as never);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("ignores unrelated upgrades and rejects invalid handshakes", () => {
    const gateway = createVisitRealtimeGateway();
    const unrelated = new FakeSocket();
    expect(
      gateway.handleUpgrade(
        request({ url: "/api/unrelated" }),
        unrelated as never,
        Buffer.alloc(0)
      )
    ).toBe(false);
    expect(unrelated.writes).toHaveLength(0);

    const invalid = new FakeSocket();
    expect(
      gateway.handleUpgrade(
        request({ headers: {} }),
        invalid as never,
        Buffer.alloc(0)
      )
    ).toBe(true);
    expect(invalid.writes).toEqual(["HTTP/1.1 400 Bad Request\r\n\r\n"]);
    expect(invalid.destroyed).toBe(true);
  });

  it("preserves upgrade head bytes and closes all sockets on shutdown", () => {
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    socket.failCloseWrite = true;
    const head = Buffer.from([0x81, 0x00]);

    expect(gateway.handleUpgrade(request(), socket as never, head)).toBe(true);
    expect(socket.unshifted).toEqual([head]);
    expect(socket.keepAlive).toBe(true);
    expect(socket.noDelay).toBe(true);

    expect(() => gateway.shutdown()).not.toThrow();
    expect(socket.destroyed).toBe(true);
    socket.emit("close");
    socket.emit("end");
    socket.emit("error", new Error("ignored after close"));
  });

  it("maintains room membership and skips closed recipients", () => {
    createVisitRealtimeGateway();
    const callbacks = handlerMocks.callbacks;
    expect(callbacks).not.toBeNull();
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const first = connection(firstSocket, { appointmentId: 9001 });
    const second = connection(secondSocket, {
      appointmentId: 9001,
      isClosed: true,
    });
    const absent = connection(new FakeSocket(), { appointmentId: 9002 });

    callbacks?.removeFromRoom?.(connection(new FakeSocket()) as never);
    callbacks?.removeFromRoom?.(absent as never);
    callbacks?.broadcastRoom?.(
      9001 as never,
      "message.new" as never,
      {} as never
    );
    callbacks?.addToRoom?.(9001 as never, first as never);
    callbacks?.addToRoom?.(9001 as never, second as never);
    callbacks?.broadcastRoom?.(
      9001 as never,
      "message.new" as never,
      { id: 1 } as never
    );

    expect(responseEvents(firstSocket)).toEqual([
      { event: "message.new", data: { id: 1 } },
    ]);
    expect(secondSocket.writes).toHaveLength(0);
    callbacks?.removeFromRoom?.(first as never);
    callbacks?.removeFromRoom?.(second as never);
    callbacks?.broadcastRoom?.(
      9001 as never,
      "message.new" as never,
      {} as never
    );
  });

  it("handles control frames and rejects malformed client events", async () => {
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    gateway.handleUpgrade(request(), socket as never, Buffer.alloc(0));

    socket.emit("data", frame(0x9));
    socket.emit("data", frame(0xa));
    socket.emit("data", frame(0x2, "ignored"));
    socket.emit("data", frame(0x1, "not-json"));
    socket.emit("data", textFrame(null));
    socket.emit("data", textFrame({ event: "room.join", data: {} }));
    socket.emit("data", textFrame({ event: "unsupported" }));
    await Promise.resolve();

    expect(socket.writes).toContainEqual(Buffer.from([0x8a, 0x00]));
    expect(responseEvents(socket)).toEqual(
      expect.arrayContaining([
        {
          event: "error",
          data: { code: "BAD_REQUEST", message: "invalid JSON payload" },
        },
        {
          event: "error",
          data: { code: "BAD_REQUEST", message: "BAD_REQUEST" },
        },
        {
          event: "error",
          data: { code: "BAD_REQUEST", message: "token is required" },
        },
        {
          event: "error",
          data: { code: "BAD_REQUEST", message: "unsupported event" },
        },
      ])
    );

    socket.emit("data", frame(0x8));
    expect(socket.destroyed).toBe(true);
    const writesAfterClose = socket.writes.length;
    socket.emit("data", textFrame({ event: "unsupported" }));
    expect(socket.writes).toHaveLength(writesAfterClose);
  });

  it("dispatches supported events and converts handler failures to safe errors", async () => {
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    gateway.handleUpgrade(request(), socket as never, Buffer.alloc(0));
    handlerMocks.handleRoomJoin.mockRejectedValueOnce(new Error("JOIN_DENIED"));
    handlerMocks.handleMessageSend.mockRejectedValueOnce(
      new Error("SEND_DENIED")
    );
    handlerMocks.handleTimerExtend.mockRejectedValueOnce("private failure");

    socket.emit(
      "data",
      textFrame({ event: "room.join", data: { token: " visit-token " } })
    );
    socket.emit("data", textFrame({ event: "message.send" }));
    socket.emit("data", textFrame({ event: "room.timer.extend" }));
    await Promise.resolve();

    expect(handlerMocks.handleRoomJoin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientIp: "198.51.100.7",
        userAgent: "Gateway-Test/1.0",
      }),
      "visit-token"
    );
    expect(handlerMocks.handleMessageSend).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {}
    );
    expect(handlerMocks.handleTimerExtend).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {}
    );
    expect(responseEvents(socket)).toEqual(
      expect.arrayContaining([
        {
          event: "error",
          data: { code: "JOIN_DENIED", message: "JOIN_DENIED" },
        },
        {
          event: "error",
          data: { code: "SEND_DENIED", message: "SEND_DENIED" },
        },
        {
          event: "error",
          data: {
            code: "INTERNAL_SERVER_ERROR",
            message: "INTERNAL_SERVER_ERROR",
          },
        },
      ])
    );
  });

  it("closes stale or unwritable connections during heartbeat", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
    const gateway = createVisitRealtimeGateway();
    const stale = new FakeSocket();
    gateway.handleUpgrade(request(), stale as never, Buffer.alloc(0));

    await vi.advanceTimersByTimeAsync(75_000);
    expect(stale.destroyed).toBe(true);

    const unwritable = new FakeSocket();
    unwritable.failPingWrite = true;
    gateway.handleUpgrade(request(), unwritable as never, Buffer.alloc(0));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(unwritable.destroyed).toBe(true);
    gateway.shutdown();
  });

  it("pushes changed room status and marks a non-joinable room read-only", async () => {
    vi.useFakeTimers();
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    gateway.handleUpgrade(request(), socket as never, Buffer.alloc(0));
    socket.emit(
      "data",
      textFrame({ event: "room.join", data: { token: "visit-token" } })
    );
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      appointment: {
        id: 9001,
        status: "ended",
        paymentStatus: "paid",
      },
      role: "patient",
    } as never);
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(false);
    vi.mocked(appointmentVisitApi.canJoinRoom).mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(handlerMocks.pushRoomStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        role: "patient",
        status: "ended",
        paymentStatus: "paid",
      })
    );
    expect(responseEvents(socket)).toContainEqual({
      event: "error",
      data: { code: "ROOM_READ_ONLY", message: "room is now read-only" },
    });
    gateway.shutdown();
  });
});
