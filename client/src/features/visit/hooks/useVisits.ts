import { useEffect, useRef, useState, type RefObject } from "react";
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
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  resolved: "en" | "zh";
};

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
  const shouldAutoScrollRef = useRef(true);
  const lastMessageRef = useRef<VisitMessageItem | null>(null);
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

    const interval = window.setInterval(async () => {
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

        setIsReconnecting(false);
      } catch {
        setIsReconnecting(true);
      }
    }, 2500);

    return () => {
      window.clearInterval(interval);
    };
  }, [accessInput, enabled, messagesQuery.data, utils.visit.pollNewMessagesByToken]);

  async function handleSend() {
    const nextContent = content.trim();
    if (!nextContent || sendMutation.isPending) {
      return;
    }

    try {
      const clientMsgId = getClientMsgId();
      const result = await sendMutation.mutateAsync({
        ...accessInput,
        content: nextContent,
        clientMsgId,
      });

      shouldAutoScrollRef.current = true;
      setMessages(prev =>
        mergeMessages(prev, [
          {
            id: result.id,
            senderType: result.senderType,
            content: nextContent,
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

  const showInitialSkeleton = messagesQuery.isLoading && messages.length === 0;

  return {
    content,
    isReconnecting,
    messages,
    messagesQuery,
    sendMutation,
    setContent,
    handleSend,
    showInitialSkeleton,
  };
}
