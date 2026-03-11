import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";
import type { ResolvedLanguage } from "@/contexts/LanguageContext";

export type JoinedPayload = {
  appointmentId: number;
  role: VisitParticipantRole;
  currentStatus: string;
  canSendMessage: boolean;
};

export type StatusPayload = {
  currentStatus: string;
  canSendMessage: boolean;
};

export type IncomingMessagePayload = {
  id: number;
  appointmentId: number;
  senderRole: "patient" | "doctor" | "system";
  textOriginal: string;
  textTranslated: string;
  sourceLanguage: string;
  targetLanguage: string;
  clientMessageId: string | null;
  createdAt: string;
};

export type TimerPayload = {
  baseDurationMinutes: number;
  extensionMinutes: number;
  totalDurationMinutes: number;
};

export type SocketEventEnvelope = {
  event: string;
  data?: unknown;
};

export type VisitSocketErrorPayload = {
  code?: string;
  message?: string;
};

export type VisitMessageDisplayLines = {
  primary: string;
  secondary: string | null;
};

export type RoomMessagesPage = {
  appointmentId: number;
  role: VisitParticipantRole;
  messages: Array<VisitMessageItem & { createdAt: Date | string }>;
  nextCursor: string | null;
  hasMore: boolean;
};

export const RECONNECT_DELAYS_MS = [1000, 2500, 5000, 10000] as const;

export function getClientMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildOutgoingMessagePayload(input: {
  textOriginal: string;
  clientMessageId: string;
}) {
  return {
    textOriginal: input.textOriginal,
    clientMessageId: input.clientMessageId,
    // Let server infer opposite language from source text to keep bilingual display consistent.
    targetLanguage: "auto" as const,
  };
}

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function mergeMessages(
  existing: VisitMessageItem[],
  incoming: VisitMessageItem[]
): VisitMessageItem[] {
  const merged = new Map<number, VisitMessageItem>();
  for (const message of existing) {
    merged.set(message.id, message);
  }
  for (const message of incoming) {
    merged.set(message.id, {
      ...message,
      createdAt: toDate(message.createdAt),
    });
  }
  return Array.from(merged.values()).sort((a, b) => {
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id - b.id;
  });
}

export function normalizeRealtimeMessage(
  payload: IncomingMessagePayload
): VisitMessageItem {
  return {
    id: payload.id,
    senderType: payload.senderRole,
    content: payload.textTranslated || payload.textOriginal,
    originalContent: payload.textOriginal,
    translatedContent: payload.textTranslated || payload.textOriginal,
    sourceLanguage: payload.sourceLanguage || "auto",
    targetLanguage: payload.targetLanguage || "auto",
    createdAt: toDate(payload.createdAt),
    clientMessageId: payload.clientMessageId,
  };
}

function normalizeLanguage(language: string) {
  const normalized = (language || "auto").trim().toLowerCase();
  if (
    normalized === "zh-cn" ||
    normalized === "zh-hans" ||
    normalized === "zh-hant" ||
    normalized === "cn"
  ) {
    return "zh";
  }
  if (normalized === "en-us" || normalized === "en-gb") {
    return "en";
  }
  return normalized;
}

export function inferTargetLanguage(message: VisitMessageItem): string {
  const sourceLanguage = normalizeLanguage(message.sourceLanguage);
  const targetLanguage = normalizeLanguage(message.targetLanguage);

  if (targetLanguage !== "auto") {
    return targetLanguage;
  }

  if (sourceLanguage !== "auto" && sourceLanguage.length > 0) {
    return sourceLanguage === "zh" ? "en" : "zh";
  }

  const isChinese = /[\u4e00-\u9fff]/.test(message.originalContent || "");
  return isChinese ? "en" : "zh";
}

export function getVisitMessageDisplayLines(
  message: VisitMessageItem,
  resolved: ResolvedLanguage
): VisitMessageDisplayLines {
  const primary = message.originalContent || message.content || "";
  const translated = message.translatedContent || message.originalContent || "";
  const targetLanguage = inferTargetLanguage(message);

  const hasMeaningfulTranslation =
    translated.trim() &&
    translated.trim() !== primary.trim();

  if (
    !hasMeaningfulTranslation ||
    targetLanguage !== resolved
  ) {
    return {
      primary,
      secondary: null,
    };
  }

  return {
    primary,
    secondary: translated,
  };
}

export function flattenHistoryPages(pages: RoomMessagesPage[]): VisitMessageItem[] {
  return [...pages]
    .reverse()
    .flatMap(page =>
      page.messages.map(message => ({
        ...message,
        createdAt: toDate(message.createdAt),
      }))
    );
}

export function isFatalCode(code: string) {
  return (
    code === "TOKEN_EXPIRED" ||
    code === "TOKEN_REVOKED" ||
    code === "TOKEN_INVALID" ||
    code === "APPOINTMENT_NOT_STARTED" ||
    code === "APPOINTMENT_NOT_ALLOWED"
  );
}

export function getWsUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/visit-room/ws`;
}
