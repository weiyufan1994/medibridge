import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createVisitRealtimeGateway } from "./realtimeGateway";

vi.mock("../appointments/tokenValidation", () => ({
  validateAppointmentAccessToken: vi.fn(),
}));

vi.mock("../appointments/chatPolicy", () => ({
  canJoinRoom: vi.fn(),
  canSendMessage: vi.fn(),
}));

vi.mock("../appointments/repo", () => ({
  getLatestMessageCursor: vi.fn(),
}));

vi.mock("./repo", () => ({
  createMessage: vi.fn(),
  getMessageById: vi.fn(),
  getMessageByClientMessageId: vi.fn(),
  getLatestMessageCursor: vi.fn(),
}));

vi.mock("./status", () => ({
  markInSessionIfTransitioned: vi.fn(),
}));

vi.mock("./translation", () => ({
  translateVisitMessage: vi.fn(),
}));

import { canJoinRoom, canSendMessage } from "../appointments/chatPolicy";
import { validateAppointmentAccessToken } from "../appointments/tokenValidation";
import { createMessage, getMessageById } from "./repo";
import { markInSessionIfTransitioned } from "./status";
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
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      role: "patient",
      appointment: {
        id: 9001,
        status: "active",
        paymentStatus: "paid",
        userId: 5001,
      },
    } as never);
    vi.mocked(canJoinRoom).mockReturnValue(true);
    vi.mocked(canSendMessage).mockReturnValue(true);
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
    vi.mocked(markInSessionIfTransitioned).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  function flushAsync() {
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  it("broadcasts translated message.new after message.send", async () => {
    const gateway = createVisitRealtimeGateway();
    const socket = new FakeSocket();
    const req = createHttpReq();

    const handled = gateway.handleUpgrade(req, socket as never, Buffer.alloc(0));
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
    const messageNewEvent = envelopes.find(event => event.event === "message.new");
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
    const handled = gateway.handleUpgrade(req, socket as never, Buffer.alloc(0));
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
