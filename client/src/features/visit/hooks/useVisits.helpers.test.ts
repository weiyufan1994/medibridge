import { describe, expect, it } from "vitest";
import {
  buildOutgoingMessagePayload,
  flattenHistoryPages,
  inferTargetLanguage,
  getWsUrl,
  getVisitMessageDisplayLines,
  isFatalCode,
  mergeMessages,
  normalizeRealtimeMessage,
  type RoomMessagesPage,
} from "@/features/visit/hooks/useVisits.helpers";
import type { VisitMessageItem } from "@/features/visit/types";

function makeMessage(
  id: number,
  senderType: VisitMessageItem["senderType"],
  createdAt: Date
): VisitMessageItem {
  return {
    id,
    senderType,
    content: `content-${id}`,
    originalContent: `original-${id}`,
    translatedContent: `translated-${id}`,
    sourceLanguage: "en",
    targetLanguage: "zh",
    createdAt,
    clientMessageId: null,
  };
}

describe("useVisits helpers", () => {
  it("buildOutgoingMessagePayload always uses auto target language", () => {
    expect(
      buildOutgoingMessagePayload({
        textOriginal: "Hello",
        clientMessageId: "cmid-1",
      })
    ).toEqual({
      textOriginal: "Hello",
      clientMessageId: "cmid-1",
      targetLanguage: "auto",
    });
  });

  it("mergeMessages deduplicates by id and sorts by createdAt then id", () => {
    const existing = [
      makeMessage(2, "doctor", new Date("2026-01-01T10:00:00.000Z")),
      makeMessage(1, "patient", new Date("2026-01-01T09:59:00.000Z")),
    ];
    const incoming = [
      {
        ...makeMessage(2, "doctor", new Date("2026-01-01T10:01:00.000Z")),
        translatedContent: "updated",
      },
      makeMessage(3, "system", new Date("2026-01-01T10:01:00.000Z")),
    ];

    const merged = mergeMessages(existing, incoming);

    expect(merged.map(message => message.id)).toEqual([1, 2, 3]);
    expect(merged[1]?.translatedContent).toBe("updated");
  });

  it("flattenHistoryPages reverses pages and normalizes date values", () => {
    const pages: RoomMessagesPage[] = [
      {
        appointmentId: 1,
        role: "patient",
        nextCursor: "cursor-2",
        hasMore: true,
        messages: [
          {
            ...makeMessage(3, "doctor", new Date("2026-02-01T10:03:00.000Z")),
            createdAt: "2026-02-01T10:03:00.000Z",
          },
        ],
      },
      {
        appointmentId: 1,
        role: "patient",
        nextCursor: null,
        hasMore: false,
        messages: [
          {
            ...makeMessage(2, "patient", new Date("2026-02-01T10:02:00.000Z")),
            createdAt: "2026-02-01T10:02:00.000Z",
          },
          {
            ...makeMessage(1, "doctor", new Date("2026-02-01T10:01:00.000Z")),
            createdAt: "2026-02-01T10:01:00.000Z",
          },
        ],
      },
    ];

    const flattened = flattenHistoryPages(pages);

    expect(flattened.map(message => message.id)).toEqual([2, 1, 3]);
    expect(flattened.every(message => message.createdAt instanceof Date)).toBe(true);
  });

  it("normalizeRealtimeMessage maps translated/original fields with fallbacks", () => {
    const normalized = normalizeRealtimeMessage({
      id: 12,
      appointmentId: 9,
      senderRole: "doctor",
      textOriginal: "原文",
      textTranslated: "",
      sourceLanguage: "",
      targetLanguage: "",
      clientMessageId: "cmid-1",
      createdAt: "2026-02-10T08:00:00.000Z",
    });

    expect(normalized.content).toBe("原文");
    expect(normalized.translatedContent).toBe("原文");
    expect(normalized.sourceLanguage).toBe("auto");
    expect(normalized.targetLanguage).toBe("auto");
    expect(normalized.createdAt).toBeInstanceOf(Date);
  });

  it("isFatalCode and getWsUrl return expected values in node env", () => {
    expect(isFatalCode("TOKEN_EXPIRED")).toBe(true);
    expect(isFatalCode("APPOINTMENT_NOT_STARTED")).toBe(true);
    expect(isFatalCode("ROOM_READ_ONLY")).toBe(false);
    expect(getWsUrl()).toBe("");
  });

  it("getVisitMessageDisplayLines shows translation only when resolved language matches target", () => {
    const message = {
      ...makeMessage(1, "patient", new Date("2026-01-01T10:00:00.000Z")),
      sourceLanguage: "en",
      targetLanguage: "zh",
      originalContent: "I have a fever",
      translatedContent: "我发烧了",
    };

    expect(getVisitMessageDisplayLines(message, "zh")).toEqual({
      primary: "I have a fever",
      secondary: "我发烧了",
    });
    expect(getVisitMessageDisplayLines(message, "en")).toEqual({
      primary: "I have a fever",
      secondary: null,
    });
  });

  it("getVisitMessageDisplayLines avoids duplicate line when translation equals original", () => {
    const message = {
      ...makeMessage(1, "patient", new Date("2026-01-01T10:00:00.000Z")),
      sourceLanguage: "en",
      targetLanguage: "zh",
      originalContent: "Hello",
      translatedContent: "Hello",
    };

    expect(getVisitMessageDisplayLines(message, "zh")).toEqual({
      primary: "Hello",
      secondary: null,
    });
  });

  it("getVisitMessageDisplayLines supports auto source/target legacy messages", () => {
    const message = {
      ...makeMessage(1, "patient", new Date("2026-01-01T10:00:00.000Z")),
      sourceLanguage: "auto",
      targetLanguage: "auto",
      originalContent: "我发烧了",
      translatedContent: "I have a fever",
    };

    expect(getVisitMessageDisplayLines(message, "en")).toEqual({
      primary: "我发烧了",
      secondary: "I have a fever",
    });
    expect(getVisitMessageDisplayLines(message, "zh")).toEqual({
      primary: "我发烧了",
      secondary: null,
    });
  });

  it("inferTargetLanguage resolves aliased languages for auto target", () => {
    expect(
      inferTargetLanguage({
        ...makeMessage(1, "patient", new Date("2026-01-01T10:00:00.000Z")),
        sourceLanguage: "zh-CN",
        targetLanguage: "auto",
      })
    ).toBe("en");

    expect(
      inferTargetLanguage({
        ...makeMessage(1, "patient", new Date("2026-01-01T10:00:00.000Z")),
        sourceLanguage: "en-US",
        targetLanguage: "auto",
      })
    ).toBe("zh");
  });
});
