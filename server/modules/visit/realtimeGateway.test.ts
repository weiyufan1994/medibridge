import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createVisitRealtimeGateway } from "./realtimeGateway";

vi.mock("../appointments/publicApi", () => ({
  appointmentVisitApi: {
    canJoinRoom: vi.fn(),
    canSendMessage: vi.fn(),
    extendConsultationByDoctorToken: vi.fn(),
    getAppointmentById: vi.fn(),
    markInSessionAfterFirstMessage: vi.fn(),
    resolveConsultationTimerState: vi.fn(() => ({
      baseDurationMinutes: 30,
      extensionMinutes: 0,
      totalDurationMinutes: 30,
    })),
    validateAccessToken: vi.fn(),
  },
}));

vi.mock("./repo", () => ({
  createMessage: vi.fn(),
  getMessageById: vi.fn(),
  getMessageByClientMessageId: vi.fn(),
  getLatestMessageCursor: vi.fn(),
}));

vi.mock("./translation", () => ({
  translateVisitMessage: vi.fn(),
}));

import { appointmentVisitApi } from "../appointments/publicApi";
import { createMessage, getMessageById } from "./repo";
import { translateVisitMessage } from "./translation";

function createWsTextFrame(payload: unknown) {
  const text = JSON.stringify(payload);
  const body = Buffer.from(text, "utf8");
  return Buffer.concat([Buffer.from([0x81, body.length]), body]);
}

function parseTextFrame(frame: Buffer) {
  const first = frame[0];
  const second = frame[1];
  if (first !== 0x81) {
    throw new Error(`unexpected ws frame opcode: ${first}`);
  }

  let payloadLength = second & 0x7f;
  let cursor = 2;
  if (payloadLength === 126) {
    payloadLength = frame.readUInt16BE(cursor);
    cursor += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(frame.readBigUInt64BE(cursor));
    cursor += 8;
  }

  return JSON.parse(
    Buffer.from(frame.subarray(cursor, cursor + payloadLength)).toString("utf8")
  );
}

class FakeSocket extends EventEmitter {
  writes: Array<string | Buffer> = [];

  setKeepAlive() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  write(chunk: string | Buffer) {
    this.writes.push(chunk);
    return true;
  }

  destroy() {
    return;
  }
}

function createHttpReq() {
  return {
    headers: {
      "sec-websocket-key": "test-key",
      upgrade: "websocket",
      connection: "upgrade",
      "sec-websocket-version": "13",
      "user-agent": "private-test-user-agent",
    },
    url: "/api/visit-room/ws",
    socket: { remoteAddress: "127.0.0.1" },
    method: "GET",
    httpVersion: "1.1",
  } as never;
}

describe("visit realtime gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      role: "patient",
      appointment: {
        id: 9001,
        status: "active",
        paymentStatus: "paid",
        userId: 5001,
      },
    } as never);
    vi.mocked(appointmentVisitApi.canJoinRoom).mockReturnValue(true);
    vi.mocked(appointmentVisitApi.canSendMessage).mockReturnValue(true);
    vi.mocked(translateVisitMessage).mockResolvedValue({
      originalContent: "我今天有点发烧",
      translatedContent: "I have a bit of fever today.",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "llm",
    } as never);
    vi.mocked(createMessage).mockResolvedValue({ insertId: 401 } as never);
    vi.mocked(getMessageById).mockResolvedValue({
      id: 401,
      appointmentId: 9001,
      senderType: "patient",
      content: "I have a bit of fever today.",
      originalContent: "我今天有点发烧",
      translatedContent: "I have a bit of fever today.",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "llm",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      clientMessageId: "msg-test-1",
    } as never);
    vi.mocked(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function flushAsync() {
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  it("logs a connection without exposing network metadata", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();

    expect(
      gateway.handleUpgrade(createHttpReq(), socket as never, Buffer.alloc(0))
    ).toBe(true);

    expect(consoleInfo).toHaveBeenCalledOnce();
    const logged = String(consoleInfo.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "visit-realtime",
      event: "client_connected",
    });
    expect(logged).not.toContain("127.0.0.1");
    expect(logged).not.toContain("private-test-user-agent");

    gateway.shutdown();
  });

  it("broadcasts translated message.new after message.send", async () => {
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    const req = createHttpReq();

    const handled = gateway.handleUpgrade(
      req,
      socket as never,
      Buffer.alloc(0)
    );
    expect(handled).toBe(true);

    const joinFrame = createWsTextFrame({
      event: "room.join",
      data: { token: "patient_token_1234567890" },
    });
    socket.emit("data", joinFrame);
    await flushAsync();

    const messageFrame = createWsTextFrame({
      event: "message.send",
      data: {
        textOriginal: "我今天有点发烧",
        clientMessageId: "msg-test-1",
        targetLanguage: "en",
      },
    });
    socket.emit("data", messageFrame);
    await flushAsync();

    const envelopes = socket.writes
      .filter(
        (chunk): chunk is Buffer =>
          Buffer.isBuffer(chunk) && chunk.length > 0 && chunk[0] === 0x81
      )
      .map(chunk => parseTextFrame(chunk));
    const events = envelopes.map(event => event.event);
    const messageNewEvent = envelopes.find(
      event => event.event === "message.new"
    );
    expect(messageNewEvent).toBeDefined();
    expect(messageNewEvent?.data).toEqual(
      expect.objectContaining({
        textOriginal: "我今天有点发烧",
        textTranslated: "I have a bit of fever today.",
        sourceLanguage: "zh",
        targetLanguage: "en",
      })
    );
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        content: "I have a bit of fever today.",
        originalContent: "我今天有点发烧",
        translatedContent: "I have a bit of fever today.",
        sourceLanguage: "zh",
        targetLanguage: "en",
        translationProvider: "llm",
        clientMessageId: "msg-test-1",
      })
    );
    expect(translateVisitMessage).toHaveBeenCalledWith({
      content: "我今天有点发烧",
      sourceLanguage: "auto",
      targetLanguage: "auto",
    });

    socket.emit("close");
  });

  it("ignores same-language targetLanguage from client and still uses opposite-language translation", async () => {
    vi.mocked(translateVisitMessage).mockResolvedValue({
      originalContent: "Hello",
      translatedContent: "你好",
      sourceLanguage: "en",
      targetLanguage: "zh",
      translationProvider: "llm",
    } as never);
    vi.mocked(createMessage).mockResolvedValue({ insertId: 402 } as never);
    vi.mocked(getMessageById).mockResolvedValue({
      id: 402,
      appointmentId: 9001,
      senderType: "patient",
      content: "你好",
      originalContent: "Hello",
      translatedContent: "你好",
      sourceLanguage: "en",
      targetLanguage: "zh",
      translationProvider: "llm",
      createdAt: new Date("2026-03-01T10:01:00.000Z"),
      clientMessageId: "msg-test-2",
    } as never);

    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    const req = createHttpReq();
    const handled = gateway.handleUpgrade(
      req,
      socket as never,
      Buffer.alloc(0)
    );
    expect(handled).toBe(true);

    socket.emit(
      "data",
      createWsTextFrame({
        event: "room.join",
        data: { token: "patient_token_1234567890" },
      })
    );
    await flushAsync();

    socket.emit(
      "data",
      createWsTextFrame({
        event: "message.send",
        data: {
          textOriginal: "Hello",
          clientMessageId: "msg-test-2",
          targetLanguage: "en",
        },
      })
    );
    await flushAsync();

    expect(translateVisitMessage).toHaveBeenCalledWith({
      content: "Hello",
      sourceLanguage: "auto",
      targetLanguage: "auto",
    });
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "你好",
        originalContent: "Hello",
        translatedContent: "你好",
        sourceLanguage: "en",
        targetLanguage: "zh",
        translationProvider: "llm",
      })
    );

    socket.emit("close");
  });
});
