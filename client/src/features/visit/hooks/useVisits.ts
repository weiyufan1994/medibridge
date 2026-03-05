import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";
import { getVisitCopy } from "@/features/visit/copy";

type VisitAccessInput = {
  token: string;
};

type UseVisitsParams = {
  accessInput: VisitAccessInput;
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  resolved: "en" | "zh";
};

type JoinedPayload = {
  appointmentId: number;
  role: VisitParticipantRole;
  currentStatus: string;
  canSendMessage: boolean;
};

type StatusPayload = {
  currentStatus: string;
  canSendMessage: boolean;
};

type IncomingMessagePayload = {
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

type SocketEventEnvelope = {
  event: string;
  data?: unknown;
};

const RECONNECT_DELAYS_MS = [1000, 2500, 5000, 10000] as const;

function getClientMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mergeMessages(
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

function normalizeRealtimeMessage(payload: IncomingMessagePayload): VisitMessageItem {
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

function isFatalCode(code: string) {
  return (
    code === "TOKEN_EXPIRED" ||
    code === "TOKEN_REVOKED" ||
    code === "TOKEN_INVALID" ||
    code === "APPOINTMENT_NOT_ALLOWED"
  );
}

function getWsUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/visit-room/ws`;
}

export function useVisits({
  accessInput,
  enabled,
  scrollContainerRef,
  resolved,
}: UseVisitsParams) {
  const t = getVisitCopy(resolved);
  const [messages, setMessages] = useState<VisitMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [pollingFatalError, setPollingFatalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [role, setRole] = useState<VisitParticipantRole | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [canSendMessageFromRoom, setCanSendMessageFromRoom] = useState<boolean | null>(null);

  const shouldAutoScrollRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const closedByAppRef = useRef(false);
  const utils = trpc.useUtils();

  const messagesQuery = trpc.visit.roomGetMessages.useQuery(
    { token: accessInput.token, limit: 50 },
    {
      enabled,
      retry: 0,
    }
  );

  const effectiveCanSend = Boolean(canSendMessageFromRoom) && !pollingFatalError;

  const getViewport = () => {
    if (!scrollContainerRef.current) return null;
    return scrollContainerRef.current.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLDivElement | null;
  };

  const isNearBottom = () => {
    const viewport = getViewport();
    if (!viewport) return true;
    const remaining =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return remaining < 140;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const viewport = getViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  useEffect(() => {
    if (!messagesQuery.data) {
      return;
    }

    const initialMessages = messagesQuery.data.messages.map(message => ({
      ...message,
      createdAt: toDate(message.createdAt),
    }));

    setMessages(initialMessages);
    setOlderCursor(messagesQuery.data.nextCursor ?? null);
    setHasMoreHistory(messagesQuery.data.hasMore);
    setRole(messagesQuery.data.role);
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messagesQuery.data]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [messages]);

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      shouldAutoScrollRef.current = isNearBottom();
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!enabled || pollingFatalError) {
      return;
    }

    closedByAppRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const connect = () => {
      const wsUrl = getWsUrl();
      if (!wsUrl) {
        return;
      }

      closeSocket();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsReconnecting(false);
        ws.send(
          JSON.stringify({
            event: "room.join",
            data: {
              token: accessInput.token,
            },
          })
        );
      };

      ws.onmessage = event => {
        let envelope: SocketEventEnvelope;
        try {
          envelope = JSON.parse(String(event.data)) as SocketEventEnvelope;
        } catch {
          return;
        }

        if (envelope.event === "room.joined") {
          const payload = envelope.data as JoinedPayload;
          setRole(payload.role);
          setCurrentStatus(payload.currentStatus);
          setCanSendMessageFromRoom(payload.canSendMessage);
          setPollingFatalError(null);
          setIsReconnecting(false);
          return;
        }

        if (envelope.event === "message.new") {
          const payload = envelope.data as IncomingMessagePayload;
          const nearBottomBeforeUpdate = isNearBottom();
          shouldAutoScrollRef.current = nearBottomBeforeUpdate;
          setMessages(prev => mergeMessages(prev, [normalizeRealtimeMessage(payload)]));
          setIsSending(false);
          return;
        }

        if (envelope.event === "room.status") {
          const payload = envelope.data as StatusPayload;
          setCurrentStatus(payload.currentStatus);
          setCanSendMessageFromRoom(payload.canSendMessage);
          return;
        }

        if (envelope.event === "error") {
          const payload = envelope.data as { code?: string; message?: string };
          const code = (payload?.code ?? "UNKNOWN_ERROR").trim();
          const message = payload?.message ?? code;

          if (isFatalCode(code)) {
            setPollingFatalError(message);
            setCanSendMessageFromRoom(false);
            setIsSending(false);
            return;
          }

          if (code !== "ROOM_READ_ONLY") {
            toast.error(message);
          }
          setIsSending(false);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setIsSending(false);
        if (!enabled || closedByAppRef.current || pollingFatalError) {
          return;
        }

        setIsReconnecting(true);
        const delayMs =
          RECONNECT_DELAYS_MS[
            Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1)
          ];
        reconnectAttemptRef.current += 1;
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      closedByAppRef.current = true;
      clearReconnectTimer();
      closeSocket();
    };
  }, [enabled, accessInput.token, pollingFatalError]);

  async function handleSend() {
    if (!effectiveCanSend || isSending) {
      return;
    }

    const nextContent = content.trim();
    if (!nextContent) {
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error(t.sendFailed);
      return;
    }

    try {
      setIsSending(true);
      ws.send(
        JSON.stringify({
          event: "message.send",
          data: {
            textOriginal: nextContent,
            clientMessageId: getClientMsgId(),
          },
        })
      );
      setContent("");
    } catch (error) {
      setIsSending(false);
      const message = error instanceof Error ? error.message : t.sendFailed;
      toast.error(message);
    }
  }

  async function loadOlderMessages() {
    if (!olderCursor || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);
    try {
      const result = await utils.visit.roomGetMessages.fetch({
        token: accessInput.token,
        beforeCursor: olderCursor,
        limit: 50,
      });
      if (result.messages.length > 0) {
        setMessages(prev => mergeMessages(result.messages, prev));
      }
      setOlderCursor(result.nextCursor);
      setHasMoreHistory(result.hasMore);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.sendFailed;
      toast.error(message);
    } finally {
      setIsLoadingOlder(false);
    }
  }

  const showInitialSkeleton = messagesQuery.isLoading && messages.length === 0;

  return {
    content,
    isReconnecting,
    messages,
    messagesQuery,
    hasMoreHistory,
    isLoadingOlder,
    pollingFatalError,
    isSending,
    role,
    currentStatus,
    canSendMessage: effectiveCanSend,
    setContent,
    loadOlderMessages,
    handleSend,
    showInitialSkeleton,
  };
}
