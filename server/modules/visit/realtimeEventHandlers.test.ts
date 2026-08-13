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
import { translateVisitMessage } from "./translation";

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

function message(id = 101) {
  return {
    id,
    appointmentId: 9001,
    userId: 44,
    senderType: "patient",
    content: "Fever",
    originalContent: "发烧",
    translatedContent: "Fever",
    sourceLanguage: "zh",
    targetLanguage: "en",
    translationProvider: "llm",
    clientMessageId: "message-1",
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
  } as never;
}

describe("visit realtime event handlers", () => {
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
    vi.mocked(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).mockResolvedValue(undefined as never);
    vi.mocked(translateVisitMessage).mockResolvedValue({
      originalContent: "发烧",
      translatedContent: "Fever",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "llm",
    } as never);
    vi.mocked(visitRepo.getLatestMessageCursor).mockResolvedValue(
      null as never
    );
    vi.mocked(visitRepo.createMessage).mockResolvedValue({ id: 101 } as never);
    vi.mocked(visitRepo.getMessageById).mockResolvedValue(message());
  });

  it("rejects messages before token validation when room or payload is invalid", async () => {
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    await handlers.handleMessageSend(connection(), requestMetadata, {
      textOriginal: "hello",
      clientMessageId: "message-1",
    });
    await handlers.handleMessageSend(
      connection({ appointmentId: 9001, role: "patient", token: "token" }),
      requestMetadata,
      { textOriginal: "  ", clientMessageId: "  " }
    );
    await handlers.handleMessageSend(
      connection({ appointmentId: 9001, role: "patient", token: "token" }),
      requestMetadata,
      { textOriginal: "x".repeat(4001), clientMessageId: "message-1" }
    );

    expect(callbacks.sendError.mock.calls.map(call => call[1])).toEqual([
      "ROOM_NOT_JOINED",
      "BAD_REQUEST",
      "BAD_REQUEST",
    ]);
    expect(appointmentVisitApi.validateAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes room status when sending is no longer allowed", async () => {
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(false);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection({
      appointmentId: 9001,
      role: "patient",
      token: "token",
    });

    await handlers.handleMessageSend(roomConnection, requestMetadata, {
      textOriginal: "hello",
      clientMessageId: "message-1",
    });

    expect(callbacks.broadcastRoom).toHaveBeenCalledWith(
      9001,
      "room.status",
      expect.objectContaining({ canSendMessage: false })
    );
    expect(callbacks.sendError).toHaveBeenCalledWith(
      roomConnection,
      "APPOINTMENT_NOT_ALLOWED"
    );
    expect(translateVisitMessage).not.toHaveBeenCalled();
  });

  it("stores and broadcasts a translated patient message", async () => {
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection({
      appointmentId: 9001,
      role: "patient",
      token: "token",
    });

    await handlers.handleMessageSend(roomConnection, requestMetadata, {
      textOriginal: "  发烧  ",
      clientMessageId: "  message-1  ",
      targetLanguage: "zh",
    });

    expect(appointmentVisitApi.validateAccessToken).toHaveBeenCalledWith({
      token: "token",
      action: "send_message",
      expectedAppointmentId: 9001,
      expectedRole: "patient",
      requestMetadata,
    });
    expect(translateVisitMessage).toHaveBeenCalledWith({
      content: "发烧",
      sourceLanguage: "auto",
      targetLanguage: "auto",
    });
    expect(visitRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        userId: 44,
        senderType: "patient",
        content: "Fever",
        clientMessageId: "message-1",
      })
    );
    expect(visitRepo.getMessageById).toHaveBeenCalledWith(101);
    expect(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).toHaveBeenCalledWith(9001);
    expect(callbacks.broadcastRoom).toHaveBeenCalledWith(
      9001,
      "message.new",
      expect.objectContaining({ id: 101, textOriginal: "发烧" })
    );
  });

  it("returns a safe error when translation fails", async () => {
    vi.mocked(translateVisitMessage).mockRejectedValue(
      new Error("provider unavailable")
    );
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection({
      appointmentId: 9001,
      role: "patient",
      token: "token",
    });

    await handlers.handleMessageSend(roomConnection, requestMetadata, {
      textOriginal: "发烧",
      clientMessageId: "message-1",
    });

    expect(callbacks.sendError).toHaveBeenCalledWith(
      roomConnection,
      "INTERNAL_SERVER_ERROR",
      "provider unavailable"
    );
    expect(visitRepo.createMessage).not.toHaveBeenCalled();
  });

  it("resolves duplicate messages idempotently", async () => {
    vi.mocked(visitRepo.createMessage).mockRejectedValue({ code: "23505" });
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      message(102)
    );
    const handlers = createVisitRealtimeEventHandlers(callbacks);

    await handlers.handleMessageSend(
      connection({ appointmentId: 9001, role: "doctor", token: "token" }),
      requestMetadata,
      { textOriginal: "发烧", clientMessageId: "message-1" }
    );

    expect(visitRepo.getMessageByClientMessageId).toHaveBeenCalledWith(
      9001,
      "message-1"
    );
    expect(callbacks.broadcastRoom).toHaveBeenCalledWith(
      9001,
      "message.new",
      expect.objectContaining({ id: 102 })
    );
  });

  it("retries a doctor message without a user id after a foreign-key error", async () => {
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      role: "doctor",
      appointment: {
        id: 9001,
        status: "active",
        paymentStatus: "paid",
        notes: null,
      },
    } as never);
    vi.mocked(visitRepo.createMessage)
      .mockRejectedValueOnce({ cause: { code: "23503" } })
      .mockResolvedValueOnce({ insertId: 103 } as never);
    vi.mocked(visitRepo.getMessageById).mockResolvedValue(message(103));
    const handlers = createVisitRealtimeEventHandlers(callbacks);

    await handlers.handleMessageSend(
      connection({ appointmentId: 9001, role: "doctor", token: "token" }),
      requestMetadata,
      { textOriginal: "发烧", clientMessageId: "message-1" }
    );

    expect(visitRepo.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: null, senderType: "doctor" })
    );
    expect(visitRepo.getMessageById).toHaveBeenCalledWith(103);
  });

  it("propagates unexpected persistence errors", async () => {
    vi.mocked(visitRepo.createMessage).mockRejectedValue(
      new Error("database unavailable")
    );
    const handlers = createVisitRealtimeEventHandlers(callbacks);

    await expect(
      handlers.handleMessageSend(
        connection({ appointmentId: 9001, role: "patient", token: "token" }),
        requestMetadata,
        { textOriginal: "发烧", clientMessageId: "message-1" }
      )
    ).rejects.toThrow("database unavailable");
  });

  it("reports an insert that cannot be resolved to a message row", async () => {
    vi.mocked(visitRepo.createMessage).mockResolvedValue({} as never);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    const roomConnection = connection({
      appointmentId: 9001,
      role: "patient",
      token: "token",
    });

    await handlers.handleMessageSend(roomConnection, requestMetadata, {
      textOriginal: "发烧",
      clientMessageId: "message-1",
    });

    expect(callbacks.sendError).toHaveBeenCalledWith(
      roomConnection,
      "INTERNAL_SERVER_ERROR",
      "failed to resolve message row"
    );
    expect(callbacks.broadcastRoom).not.toHaveBeenCalled();
  });

  it("validates timer requests and broadcasts successful extensions", async () => {
    vi.mocked(
      appointmentVisitApi.extendConsultationByDoctorToken
    ).mockResolvedValue({
      baseDurationMinutes: 30,
      extensionMinutes: 15,
      totalDurationMinutes: 45,
    } as never);
    const handlers = createVisitRealtimeEventHandlers(callbacks);
    await handlers.handleTimerExtend(connection(), requestMetadata, {
      requestId: "timer-1",
      minutes: 15,
    });
    const joined = connection({ appointmentId: 9001, token: "token" });
    await handlers.handleTimerExtend(joined, requestMetadata, {
      requestId: " ",
      minutes: 15,
    });
    await handlers.handleTimerExtend(joined, requestMetadata, {
      requestId: "timer-1",
      minutes: 1.5,
    });
    await handlers.handleTimerExtend(joined, requestMetadata, {
      requestId: " timer-1 ",
      minutes: 15,
    });

    expect(callbacks.sendError.mock.calls.map(call => call[1])).toEqual([
      "ROOM_NOT_JOINED",
      "BAD_REQUEST",
      "BAD_REQUEST",
    ]);
    expect(
      appointmentVisitApi.extendConsultationByDoctorToken
    ).toHaveBeenCalledWith({
      appointmentId: 9001,
      token: "token",
      extensionMinutes: 15,
      requestMetadata,
    });
    expect(callbacks.broadcastRoom).toHaveBeenCalledWith(9001, "room.timer", {
      baseDurationMinutes: 30,
      extensionMinutes: 15,
      totalDurationMinutes: 45,
    });
  });
});
