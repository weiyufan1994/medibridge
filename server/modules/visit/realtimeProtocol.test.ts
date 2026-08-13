import { describe, expect, it } from "vitest";

import {
  acceptWebSocket,
  asErrorCode,
  closeFrame,
  encodeCursor,
  getReqIp,
  getReqUserAgent,
  jsonToTextFrame,
  parseFrames,
  pingFrame,
  toWireMessage,
} from "./realtimeProtocol";

function request(headers: Record<string, string | string[] | undefined> = {}) {
  return {
    headers,
    socket: { remoteAddress: "203.0.113.8" },
  } as never;
}

function maskedFrame(payload: string, mode: "short" | "medium" | "long") {
  const body = Buffer.from(payload, "utf8");
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  let header: Buffer;
  if (mode === "short") {
    header = Buffer.from([0x81, 0x80 | body.length]);
  } else if (mode === "medium") {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  const masked = Buffer.from(body);
  for (let index = 0; index < masked.length; index += 1) {
    masked[index] ^= mask[index % mask.length];
  }
  return Buffer.concat([header, mask, masked]);
}

describe("visit realtime protocol", () => {
  it("encodes a stable base64url message cursor", () => {
    const cursor = encodeCursor(new Date("2026-08-13T01:02:03.000Z"), 42);

    expect(Buffer.from(cursor, "base64url").toString("utf8")).toBe(
      "2026-08-13T01:02:03.000Z|42"
    );
  });

  it("maps persisted messages to the wire format and preserves metadata", () => {
    expect(
      toWireMessage({
        id: 51,
        appointmentId: 61,
        senderType: "doctor",
        originalContent: "Original",
        translatedContent: "Translated",
        content: "Legacy",
        sourceLanguage: "en",
        targetLanguage: "zh",
        clientMessageId: "client-51",
        createdAt: new Date("2026-08-13T01:02:03.000Z"),
      } as never)
    ).toEqual({
      id: 51,
      appointmentId: 61,
      senderRole: "doctor",
      textOriginal: "Original",
      textTranslated: "Translated",
      sourceLanguage: "en",
      targetLanguage: "zh",
      clientMessageId: "client-51",
      createdAt: "2026-08-13T01:02:03.000Z",
    });
  });

  it("falls back to legacy message content and safe wire defaults", () => {
    expect(
      toWireMessage({
        id: 52,
        appointmentId: 62,
        senderType: "patient",
        originalContent: null,
        translatedContent: null,
        content: null,
        sourceLanguage: null,
        targetLanguage: null,
        clientMessageId: null,
        createdAt: new Date("2026-08-13T02:03:04.000Z"),
      } as never)
    ).toMatchObject({
      textOriginal: "",
      textTranslated: "",
      sourceLanguage: "auto",
      targetLanguage: "auto",
      clientMessageId: null,
    });
  });

  it.each([
    ["short", { value: "x".repeat(10) }, 2, 10],
    ["medium", { value: "x".repeat(200) }, 4, 200],
    ["long", { value: "x".repeat(70_000) }, 10, 70_000],
  ] as const)(
    "encodes a %s server text frame",
    (_label, payload, headerLength, minimumPayloadLength) => {
      const frame = jsonToTextFrame(payload);

      expect(frame[0]).toBe(0x81);
      expect(frame.length).toBeGreaterThanOrEqual(
        headerLength + minimumPayloadLength
      );
      const { frames, remaining } = parseFrames(frame);
      expect(frames).toHaveLength(1);
      expect(JSON.parse(frames[0].payload.toString("utf8"))).toEqual(payload);
      expect(remaining).toHaveLength(0);
    }
  );

  it("creates canonical ping and close control frames", () => {
    expect(pingFrame()).toEqual(Buffer.from([0x89, 0x00]));
    expect(closeFrame()).toEqual(Buffer.from([0x88, 0x00]));
  });

  it("accepts a valid case-insensitive WebSocket upgrade", () => {
    const response = acceptWebSocket(
      request({
        "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
        "sec-websocket-version": "13",
        upgrade: "WebSocket",
        connection: "keep-alive, Upgrade",
      })
    );

    expect(response).toContain("HTTP/1.1 101 Switching Protocols");
    expect(response).toContain(
      "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
    );
  });

  it.each([
    ["missing key", {}],
    [
      "wrong version",
      {
        "sec-websocket-key": "key",
        "sec-websocket-version": "12",
        upgrade: "websocket",
        connection: "upgrade",
      },
    ],
    [
      "wrong upgrade",
      {
        "sec-websocket-key": "key",
        "sec-websocket-version": "13",
        upgrade: "h2c",
        connection: "upgrade",
      },
    ],
    [
      "missing connection upgrade token",
      {
        "sec-websocket-key": "key",
        "sec-websocket-version": "13",
        upgrade: "websocket",
        connection: "keep-alive",
      },
    ],
  ])("rejects a handshake with %s", (_label, headers) => {
    expect(acceptWebSocket(request(headers))).toBeNull();
  });

  it.each([
    ["short", "hello"],
    ["medium", "m".repeat(200)],
    ["long", "l".repeat(66_000)],
  ] as const)("parses a masked %s client frame", (mode, payload) => {
    const parsed = parseFrames(maskedFrame(payload, mode));

    expect(parsed.frames).toEqual([
      { opcode: 1, payload: Buffer.from(payload, "utf8") },
    ]);
    expect(parsed.remaining).toHaveLength(0);
  });

  it("returns complete frames and preserves an incomplete trailing frame", () => {
    const complete = maskedFrame("complete", "short");
    const incomplete = maskedFrame("partial payload", "short").subarray(0, 7);
    const parsed = parseFrames(Buffer.concat([complete, incomplete]));

    expect(parsed.frames).toHaveLength(1);
    expect(parsed.frames[0].payload.toString("utf8")).toBe("complete");
    expect(parsed.remaining).toEqual(incomplete);
  });

  it.each([
    [Buffer.from([0x81, 126, 0x00]), 3],
    [Buffer.from([0x81, 127, 0x00, 0x00]), 4],
  ])("preserves an incomplete extended-length header", (frame, length) => {
    const parsed = parseFrames(frame);

    expect(parsed.frames).toHaveLength(0);
    expect(parsed.remaining).toHaveLength(length);
  });

  it("rejects frame lengths outside JavaScript's safe integer range", () => {
    const frame = Buffer.alloc(10);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 2);

    expect(() => parseFrames(frame)).toThrow("Unsupported frame length");
  });

  it("extracts trusted proxy metadata with socket fallbacks", () => {
    const forwarded = request({
      "x-forwarded-for": " 198.51.100.7, 203.0.113.9 ",
      "user-agent": "MediBridge-Test/1.0",
    });
    expect(getReqIp(forwarded)).toBe("198.51.100.7");
    expect(getReqUserAgent(forwarded)).toBe("MediBridge-Test/1.0");

    const direct = request();
    expect(getReqIp(direct)).toBe("203.0.113.8");
    expect(getReqUserAgent(direct)).toBeNull();
  });

  it("uses a non-empty Error message or a safe internal code", () => {
    expect(asErrorCode(new Error("TOKEN_EXPIRED"))).toBe("TOKEN_EXPIRED");
    expect(asErrorCode(new Error("   "))).toBe("INTERNAL_SERVER_ERROR");
    expect(asErrorCode("private failure detail")).toBe("INTERNAL_SERVER_ERROR");
  });
});
