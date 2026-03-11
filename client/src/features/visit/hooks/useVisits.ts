import { useEffect, useRef, useState, type RefObject } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";
import { getVisitCopy } from "@/features/visit/copy";
import {
  buildOutgoingMessagePayload,
  flattenHistoryPages,
  getClientMsgId,
  isFatalCode,
  mergeMessages,
  normalizeRealtimeMessage,
  type RoomMessagesPage,
  type TimerPayload,
  type VisitSocketErrorPayload,
} from "@/features/visit/hooks/useVisits.helpers";
import { useVisitRoomSocket } from "@/features/visit/hooks/useVisitRoomSocket";

type VisitAccessInput = {
  token: string;
};

type UseVisitsParams = {
  accessInput: VisitAccessInput;
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  resolved: "en" | "zh";
};

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
  const [pollingFatalError, setPollingFatalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [role, setRole] = useState<VisitParticipantRole | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [canSendMessageFromRoom, setCanSendMessageFromRoom] = useState<boolean | null>(null);
  const [roomTimer, setRoomTimer] = useState<TimerPayload | null>(null);
  const [isExtendingTimer, setIsExtendingTimer] = useState(false);

  const shouldAutoScrollRef = useRef(true);
  const hasHydratedInitialMessagesRef = useRef(false);
  const topAutoLoadLockRef = useRef(false);
  const utils = trpc.useUtils();

  const messagesInfiniteQuery = useInfiniteQuery({
    queryKey: ["visit", "roomGetMessages", accessInput.token],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      utils.visit.roomGetMessages.fetch({
        token: accessInput.token,
        limit: 50,
        beforeCursor: pageParam ?? undefined,
      }) as Promise<RoomMessagesPage>,
    getNextPageParam: lastPage => lastPage.nextCursor,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const hasMoreHistory = Boolean(messagesInfiniteQuery.hasNextPage);
  const isLoadingOlder = messagesInfiniteQuery.isFetchingNextPage;
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
    setMessages([]);
    setRole(null);
    setCurrentStatus(null);
    setCanSendMessageFromRoom(null);
    setPollingFatalError(null);
    setRoomTimer(null);
    setIsExtendingTimer(false);
    hasHydratedInitialMessagesRef.current = false;
    topAutoLoadLockRef.current = false;
  }, [accessInput.token]);

  useEffect(() => {
    const pages = messagesInfiniteQuery.data?.pages;
    if (!pages || pages.length === 0) {
      return;
    }

    const flattened = flattenHistoryPages(pages);
    setMessages(prev => mergeMessages(flattened, prev));
    setRole(pages[0].role);

    if (!hasHydratedInitialMessagesRef.current) {
      hasHydratedInitialMessagesRef.current = true;
      shouldAutoScrollRef.current = true;
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [messagesInfiniteQuery.data]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [messages]);

  async function loadOlderMessages() {
    if (!hasMoreHistory || isLoadingOlder) {
      return;
    }

    const viewport = getViewport();
    const previousHeight = viewport?.scrollHeight ?? 0;
    const previousTop = viewport?.scrollTop ?? 0;

    try {
      await messagesInfiniteQuery.fetchNextPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.sendFailed;
      toast.error(message);
      return;
    }

    if (!viewport) {
      return;
    }

    requestAnimationFrame(() => {
      // Keep viewport anchored after prepending older messages.
      const nextHeight = viewport.scrollHeight;
      const delta = nextHeight - previousHeight;
      viewport.scrollTop = previousTop + delta;
    });
  }

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      shouldAutoScrollRef.current = isNearBottom();

      if (viewport.scrollTop > 160) {
        topAutoLoadLockRef.current = false;
      }

      if (
        viewport.scrollTop <= 80 &&
        !topAutoLoadLockRef.current &&
        hasMoreHistory &&
        !isLoadingOlder
      ) {
        // Infinite scroll for chat history: when user reaches the top, fetch older page.
        topAutoLoadLockRef.current = true;
        void loadOlderMessages();
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [hasMoreHistory, isLoadingOlder]);

  const { sendEvent } = useVisitRoomSocket({
    enabled,
    token: accessInput.token,
    pollingFatalError,
    onJoined: payload => {
      setRole(payload.role);
      setCurrentStatus(payload.currentStatus);
      setCanSendMessageFromRoom(payload.canSendMessage);
      setPollingFatalError(null);
      setIsReconnecting(false);
    },
    onIncomingMessage: payload => {
      const nearBottomBeforeUpdate = isNearBottom();
      shouldAutoScrollRef.current = nearBottomBeforeUpdate;
      setMessages(prev => mergeMessages(prev, [normalizeRealtimeMessage(payload)]));
      setIsSending(false);
    },
    onStatus: payload => {
      setCurrentStatus(payload.currentStatus);
      setCanSendMessageFromRoom(payload.canSendMessage);
    },
    onTimer: payload => {
      setRoomTimer(payload);
      setIsExtendingTimer(false);
    },
    onError: payload => {
      const code = (payload?.code ?? "UNKNOWN_ERROR").trim();
      const message = payload?.message ?? code;

      if (isFatalCode(code)) {
        setPollingFatalError(message);
        setCanSendMessageFromRoom(false);
        setIsSending(false);
        return;
      }

      if (code === "CONSULTATION_EXTENSION_ALREADY_USED") {
        toast.error(t.timerExtendAlreadyUsed);
      } else if (code === "CONSULTATION_EXTENSION_CONFLICT") {
        toast.error(t.timerExtendFailed);
      } else if (code === "ROOM_READ_ONLY") {
        setCanSendMessageFromRoom(false);
      } else {
        toast.error(message);
      }
      setIsExtendingTimer(false);
      setIsSending(false);
    },
    onSocketClosed: () => {
      setIsSending(false);
    },
    onReconnectingChange: value => {
      setIsReconnecting(value);
    },
  });

  async function handleSend() {
    if (!effectiveCanSend || isSending) {
      return;
    }

    const nextContent = content.trim();
    if (!nextContent) {
      return;
    }

    setIsSending(true);
    const clientMessageId = getClientMsgId();
    const didSend = sendEvent("message.send", {
      ...buildOutgoingMessagePayload({
        textOriginal: nextContent,
        clientMessageId,
      }),
    });
    if (!didSend) {
      setIsSending(false);
      toast.error(t.sendFailed);
      return;
    }
    setContent("");
  }

  function requestTimerExtension(minutes = 5) {
    if (isExtendingTimer) {
      return false;
    }
    const didSend = sendEvent("room.timer.extend", {
      requestId: getClientMsgId(),
      minutes,
    });
    if (!didSend) {
      toast.error(t.timerExtendFailed);
      return false;
    }
    setIsExtendingTimer(true);
    return true;
  }

  const showInitialSkeleton = messagesInfiniteQuery.isLoading && messages.length === 0;

  function markRoomAsClosed(nextStatus: "ended" | "completed" = "ended") {
    setCurrentStatus(nextStatus);
    setCanSendMessageFromRoom(false);
  }

  return {
    content,
    isReconnecting,
    messages,
    messagesQuery: messagesInfiniteQuery,
    hasMoreHistory,
    isLoadingOlder,
    pollingFatalError,
    isSending,
    role,
    currentStatus,
    canSendMessage: effectiveCanSend,
    roomTimer,
    isExtendingTimer,
    setContent,
    loadOlderMessages,
    handleSend,
    requestTimerExtension,
    markRoomAsClosed,
    showInitialSkeleton,
  };
}
