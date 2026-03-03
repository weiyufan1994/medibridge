import { useEffect, useRef, useState, type RefObject } from "react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { VisitMessageItem } from "@/features/visit/types";
import { getVisitCopy } from "@/features/visit/copy";

type VisitAccessInput = {
  appointmentId: number;
  token: string;
};

type UseVisitsParams = {
  accessInput: VisitAccessInput;
  enabled: boolean;
  canSend: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  resolved: "en" | "zh";
};

const POLL_BASE_INTERVAL_MS = 2500;
const POLL_RETRY_DELAYS_MS = [2000, 5000, 10000] as const;

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

function isFatalPollingError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return false;
  }

  if (error.data?.code === "UNAUTHORIZED") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("magic link has expired") ||
    message.includes("magic link has been revoked") ||
    message.includes("doctor magic link has been revoked") ||
    message.includes("invalid magic link token") ||
    message.includes("token expired") ||
    message.includes("token revoked")
  );
}

export function useVisits({
  accessInput,
  enabled,
  canSend,
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
  const shouldAutoScrollRef = useRef(true);
  const lastMessageRef = useRef<VisitMessageItem | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const pollingStoppedRef = useRef(false);
  const utils = trpc.useUtils();

  const messagesQuery = trpc.visit.getMessagesByToken.useQuery(
    { ...accessInput, limit: 50 },
    {
      enabled,
      retry: 0,
    }
  );

  const sendMutation = trpc.visit.sendMessageByToken.useMutation();

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
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messagesQuery.data]);

  useEffect(() => {
    lastMessageRef.current =
      messages.length > 0 ? messages[messages.length - 1] : null;

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
    if (!enabled || !messagesQuery.data) {
      return;
    }

    pollingStoppedRef.current = false;
    retryAttemptRef.current = 0;
    setPollingFatalError(null);

    const clearPollTimer = () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const schedulePoll = (delayMs: number) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(() => {
        void runPoll();
      }, delayMs);
    };

    const runPoll = async () => {
      if (pollingStoppedRef.current) {
        return;
      }

      const lastMessage = lastMessageRef.current;
      try {
        const result = await utils.visit.pollNewMessagesByToken.fetch({
          ...accessInput,
          afterCreatedAt: lastMessage?.createdAt,
          afterId: lastMessage?.id,
          limit: 100,
        });

        if (result.messages.length > 0) {
          const nearBottomBeforeUpdate = isNearBottom();
          shouldAutoScrollRef.current = nearBottomBeforeUpdate;
          setMessages(prev => mergeMessages(prev, result.messages));
        }

        retryAttemptRef.current = 0;
        setIsReconnecting(false);
        schedulePoll(POLL_BASE_INTERVAL_MS);
      } catch (error) {
        if (isFatalPollingError(error)) {
          pollingStoppedRef.current = true;
          setIsReconnecting(false);
          setPollingFatalError("Session expired. Request a new link.");
          clearPollTimer();
          return;
        }

        setIsReconnecting(true);
        const retryDelay =
          POLL_RETRY_DELAYS_MS[
            Math.min(retryAttemptRef.current, POLL_RETRY_DELAYS_MS.length - 1)
          ];
        retryAttemptRef.current += 1;
        schedulePoll(retryDelay);
      }
    };

    schedulePoll(POLL_BASE_INTERVAL_MS);

    return () => {
      pollingStoppedRef.current = true;
      clearPollTimer();
    };
  }, [accessInput, enabled, messagesQuery.data, utils.visit.pollNewMessagesByToken]);

  async function handleSend() {
    if (!canSend || pollingFatalError) {
      return;
    }

    const nextContent = content.trim();
    if (!nextContent || sendMutation.isPending) {
      return;
    }

    try {
      const clientMsgId = getClientMsgId();
      const result = await sendMutation.mutateAsync({
        ...accessInput,
        content: nextContent,
        sourceLanguage: resolved,
        targetLanguage: resolved,
        clientMsgId,
      });

      shouldAutoScrollRef.current = true;
      setMessages(prev =>
        mergeMessages(prev, [
          {
            id: result.id,
            senderType: result.senderType,
            content: nextContent,
            originalContent: nextContent,
            translatedContent: nextContent,
            sourceLanguage: resolved,
            targetLanguage: resolved,
            createdAt: toDate(result.createdAt),
            clientMsgId,
          },
        ])
      );
      setContent("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t.sendFailed;
      toast.error(message);
    }
  }

  async function loadOlderMessages() {
    if (!olderCursor || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);
    try {
      const result = await utils.visit.getMessagesByToken.fetch({
        ...accessInput,
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
    sendMutation,
    setContent,
    loadOlderMessages,
    handleSend,
    showInitialSkeleton,
  };
}
