import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatComposer } from "./ChatComposer";
import { MessageBubble, type VisitMessageItem } from "./MessageBubble";

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

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

function getAppointmentTypeLabel(
  type: "online_chat" | "video_call" | "in_person"
) {
  if (type === "online_chat") return "Online chat";
  if (type === "video_call") return "Video call";
  return "In person";
}

function isInSession(
  scheduledAt: Date | null,
  status: "pending" | "confirmed" | "rescheduled" | "completed" | "cancelled"
) {
  if (status === "completed" || status === "cancelled") {
    return false;
  }
  if (!scheduledAt) {
    return false;
  }
  return scheduledAt.getTime() <= Date.now();
}

export default function VisitRoomPage() {
  const { resolved } = useLanguage();
  const [, params] = useRoute<{ id: string }>("/visit/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();
  const validInput =
    Number.isInteger(appointmentId) && appointmentId > 0 && token.length >= 16;

  const [messages, setMessages] = useState<VisitMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastMessageRef = useRef<VisitMessageItem | null>(null);
  const utils = trpc.useUtils();

  const accessInput = useMemo(
    () => ({
      appointmentId: validInput ? appointmentId : 1,
      token: validInput ? token : "invalid-token-000",
    }),
    [appointmentId, token, validInput]
  );

  const appointmentQuery = trpc.appointments.getByToken.useQuery(accessInput, {
    enabled: validInput,
    retry: 0,
  });

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: appointmentQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(appointmentQuery.data?.doctorId),
      retry: 1,
    }
  );

  const messagesQuery = trpc.visit.getMessagesByToken.useQuery(
    { ...accessInput, limit: 50 },
    {
      enabled: validInput,
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
    if (!validInput || !messagesQuery.data) {
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
  }, [
    accessInput,
    messagesQuery.data,
    utils.visit.pollNewMessagesByToken,
    validInput,
  ]);

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
          : "Failed to send message. Please retry.";
      toast.error(message);
    }
  }

  if (!validInput) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          Missing or invalid token.
        </Card>
      </main>
    );
  }

  if (appointmentQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    );
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          {appointmentQuery.error?.message || "Appointment not found."}
        </Card>
      </main>
    );
  }

  const appointment = appointmentQuery.data;
  const doctorData = doctorQuery.data;
  const doctorName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.name,
        en: doctorData.doctor.nameEn,
        placeholder: "Assigned doctor",
      })
    : "Assigned doctor";
  const departmentName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.department.name,
        en: doctorData.department.nameEn,
        placeholder: "Department",
      })
    : "Department";
  const appointmentType = getAppointmentTypeLabel(appointment.appointmentType);
  const scheduledAt = appointment.scheduledAt
    ? toDate(appointment.scheduledAt)
    : null;
  const scheduledTimeText =
    scheduledAt?.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }) || "TBD";
  const inSession = isInSession(scheduledAt, appointment.status);

  const showInitialSkeleton = messagesQuery.isLoading && messages.length === 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">MediBridge</h1>
            <p className="text-xs text-slate-600">
              AI-Powered Medical Bridge to China
            </p>
          </div>
        </div>
      </header>

      <Card className="h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border-slate-200 shadow-sm">
        <header className="shrink-0 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 border border-slate-200">
                <AvatarImage
                  src={doctorData?.doctor.imageUrl ?? undefined}
                  alt={doctorName}
                />
                <AvatarFallback className="bg-slate-100 text-slate-700">
                  {doctorName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {doctorName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {departmentName} · {appointmentType}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={inSession ? "default" : "secondary"}
                  className={
                    inSession
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }
                >
                  {inSession ? "In session" : "Scheduled"}
                </Badge>
                {isReconnecting ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Reconnecting...
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">{scheduledTimeText}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">聊天记录保留 7 天</p>
        </header>

        <Separator />

        <section className="min-h-0 flex-1">
          <div ref={scrollContainerRef} className="h-full">
            <ScrollArea className="h-full">
              <div className="p-5">
                {showInitialSkeleton ? (
                  <div className="space-y-3">
                    <div className="flex justify-start">
                      <Skeleton className="h-14 w-[68%] rounded-2xl" />
                    </div>
                    <div className="flex justify-start">
                      <Skeleton className="h-12 w-[54%] rounded-2xl" />
                    </div>
                    <div className="flex justify-end">
                      <Skeleton className="h-12 w-[60%] rounded-2xl" />
                    </div>
                    <div className="flex justify-end">
                      <Skeleton className="h-10 w-[45%] rounded-2xl" />
                    </div>
                    <div className="flex justify-start">
                      <Skeleton className="h-12 w-[63%] rounded-2xl" />
                    </div>
                    <div className="flex justify-center">
                      <Skeleton className="h-6 w-40 rounded-full" />
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="pt-6 text-center text-sm text-slate-500">
                    No messages yet. Start your consultation below.
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const previous = messages[index - 1];
                    const next = messages[index + 1];
                    const compactWithPrev = Boolean(
                      previous && previous.senderType === message.senderType
                    );
                    const showTimestamp =
                      !next || next.senderType !== message.senderType;

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        compactWithPrev={compactWithPrev}
                        showTimestamp={showTimestamp}
                      />
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </section>

        <Separator />

        <footer className="shrink-0">
          <ChatComposer
            value={content}
            onChange={setContent}
            onSend={() => void handleSend()}
            disabled={sendMutation.isPending}
            isSending={sendMutation.isPending}
            placeholder={
              resolved === "zh"
                ? "输入消息，描述你的问题..."
                : "Type your message and describe your concern..."
            }
            hint={
              resolved === "zh"
                ? "Enter 发送，Shift+Enter 换行"
                : "Enter to send, Shift+Enter for new line"
            }
          />
        </footer>
      </Card>
    </main>
  );
}
