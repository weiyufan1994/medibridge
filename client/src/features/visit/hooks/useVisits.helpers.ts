import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";

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

export type SocketEventEnvelope = {
  event: string;
  data?: unknown;
};

export type VisitSocketErrorPayload = {
  code?: string;
  message?: string;
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
