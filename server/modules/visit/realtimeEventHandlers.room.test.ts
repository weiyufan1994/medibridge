import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestMetadata } from "@shared/requestMetadata";
import type { RoomConnection } from "./realtimeProtocol";

vi.mock("../appointments/publicApi", () => ({
  appointmentVisitApi: {
    canJoinRoom: vi.fn(),
    canSendMessage: vi.fn(),
    extendConsultationByDoctorToken: vi.fn(),
    markInSessionAfterFirstMessage: vi.fn(),
    resolveConsultationTimerState: vi.fn(),
    validateAccessToken: vi.fn(),
  },
}));

vi.mock("./repo", () => ({
  createMessage: vi.fn(),
  getLatestMessageCursor: vi.fn(),
  getMessageByClientMessageId: vi.fn(),
  getMessageById: vi.fn(),
}));
vi.mock("./translation", () => ({ translateVisitMessage: vi.fn() }));

import { appointmentVisitApi } from "../appointments/publicApi";
import { createVisitRealtimeEventHandlers } from "./realtimeEventHandlers";
import * as visitRepo from "./repo";

const requestMetadata: RequestMetadata = {
  clientIp: "198.51.100.7",
  forwardedHost: null,
  forwardedProto: null,
  host: "medibridge.test",
  protocol: "https",
  requestId: "request-1",
  userAgent: "Realtime-Test/1.0",
};

function connection(overrides: Partial<RoomConnection> = {}): RoomConnection {
  return {
    id: "connection-1",
    socket: {} as RoomConnection["socket"],
    buffer: Buffer.alloc(0),
    isClosed: false,
    token: null,
    appointmentId: null,
    role: null,
    status: null,
    canSendMessage: false,
    lastPongAtMs: 0,
    heartbeatTimer: null,
    statusTimer: null,
    ...overrides,
  };
}

describe("visit realtime room events", () => {
  const callbacks = {
    sendEvent: vi.fn(),
    sendError: vi.fn(),
    removeFromRoom: vi.fn(),
    broadcastRoom: vi.fn(),
    addToRoom: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentVisitApi.canJoinRoom).mockReturnValue(true);
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(true);
    vi.mocked(
      appointmentVisitApi.resolveConsultationTimerState
    ).mockReturnValue({
      baseDurationMinutes: 30,
      extensionMinutes: 10,
      totalDurationMinutes: 40,
    } as never);
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      role: "patient",
      appointment: {
        id: 9001,
        userId: 44,
        status: "active",
        paymentStatus: "paid",
        notes: "timer-state",
      },
    } as never);
    vi.mocked(visitRepo.getLatestMessageCursor).mockResolvedValue(
      null as never
    );
  });

  it("rejects a room join when the appointment policy disallows it", async () => {
    vi.mocked(appointmentVisitApi.canJoinRoom).mockReturnValue(false);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection();

    await handlers.handleRoomJoin(
      roomConnection,
      requestMetadata,
      "visit-token"
    );

    expect(callbacks.sendError).toHaveBeenCalledWith(
      roomConnection,
      "APPOINTMENT_NOT_ALLOWED"
    );
    expect(callbacks.addToRoom).not.toHaveBeenCalled();
  });

  it("joins an allowed room with cursor, role, and timer state", async () => {
    const cursorDate = new Date("2026-08-13T07:59:00.000Z");
    vi.mocked(visitRepo.getLatestMessageCursor).mockResolvedValue({
      id: 100,
      createdAt: cursorDate,
    } as never);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection({ appointmentId: 88 });

    await handlers.handleRoomJoin(
      roomConnection,
      requestMetadata,
      "visit-token"
    );

    expect(callbacks.removeFromRoom).toHaveBeenCalledWith(roomConnection);
    expect(roomConnection).toMatchObject({
      token: "visit-token",
      appointmentId: 9001,
      role: "patient",
      status: "active",
      canSendMessage: true,
    });
    expect(callbacks.addToRoom).toHaveBeenCalledWith(9001, roomConnection);
    expect(callbacks.sendEvent).toHaveBeenNthCalledWith(
      1,
      roomConnection,
      "room.joined",
      expect.objectContaining({
        appointmentId: 9001,
        recentCursor: Buffer.from(
          `${cursorDate.toISOString()}|100`,
          "utf8"
        ).toString("base64url"),
      })
    );
    expect(callbacks.sendEvent).toHaveBeenNthCalledWith(
      2,
      roomConnection,
      "room.timer",
      {
        baseDurationMinutes: 30,
        extensionMinutes: 10,
        totalDurationMinutes: 40,
      }
    );
  });

  it("pushes current send permissions to every room member", async () => {
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(false);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection();

    await handlers.pushRoomStatus({
      connection: roomConnection,
      appointmentId: 9001,
      role: "doctor",
      status: "completed",
      paymentStatus: "paid",
    });

    expect(roomConnection).toMatchObject({
      status: "completed",
      canSendMessage: false,
    });
    expect(callbacks.broadcastRoom).toHaveBeenCalledWith(9001, "room.status", {
      appointmentId: 9001,
      role: "doctor",
      currentStatus: "completed",
      canSendMessage: false,
    });
  });
});
