import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  PanelLeft,
  PanelLeftOpen,
  Plus,
  Send,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedTextWithZhFallback } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DisclaimerDialog, DisclaimerNotice } from "@/components/disclaimer/DisclaimerDialog";
import { useTriageChat } from "@/features/triage/hooks/useTriageChat";
import {
  getLocalizedInterruptionDetail,
  getTriageCopy,
} from "@/features/triage/copy";
import {
  getAssistantMessageSignature,
  getMessageContainerClass,
  getTriageResultContainerClass,
  resolveAnimatedAssistantSignature,
  type TriageDisplayMessage,
} from "@/features/triage/components/aiTriageMessagePresentation";
import { AppointmentModal } from "@/features/appointment/components/AppointmentModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { LocalizedText } from "@shared/types";

type AITriageChatProps = {
  onSelectDoctor?: (payload: {
    doctorId: number;
    summary: string;
    keywords: string[];
  }) => void;
};

type HistoryItem = {
  id: number;
  title: string;
  status: "active" | "completed";
  group: "today" | "previous7" | "older";
};

const buildCurrentSessionSidebarTitle = (input: {
  messages: TriageDisplayMessage[];
  triageResult: { summary?: string } | null;
  fallbackTitle: string;
}) => {
  const summaryTitle = input.triageResult?.summary?.trim();
  if (summaryTitle) {
    return summaryTitle.slice(0, 255);
  }

  const firstUserMessage = input.messages.find(message => message.role === "user")?.content?.trim();
  if (firstUserMessage) {
    return firstUserMessage.replace(/\s+/g, " ").slice(0, 255);
  }

  return input.fallbackTitle;
};

type RecommendedDoctor = {
  doctor: {
    id: number;
    name: LocalizedText;
    title: LocalizedText;
    specialty: LocalizedText;
    description: string | null;
    imageUrl: string | null;
    experience: string | null;
  };
  department: {
    name: LocalizedText;
  };
  title: LocalizedText;
  specialty: LocalizedText;
  biography: LocalizedText;
  reason: LocalizedText;
  yearsOfExperience: number | null;
};

const TypewriterMessage = memo(
  function TypewriterMessage(props: {
    text: string;
    speed?: number;
    active?: boolean;
    onProgress?: () => void;
  }) {
    const { text, speed = 20, active = false, onProgress } = props;
    const [displayedText, setDisplayedText] = useState(active ? "" : text);
    const intervalRef = useRef<number | null>(null);
    const cursorRef = useRef(active ? 0 : text.length);
    const isCompletedRef = useRef(!active);
    const latestOnProgressRef = useRef(onProgress);
    const latestTextRef = useRef(text);

    useEffect(() => {
      latestOnProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
      if (latestTextRef.current !== text) {
        latestTextRef.current = text;
        cursorRef.current = active ? 0 : text.length;
        isCompletedRef.current = !active;
        setDisplayedText(active ? "" : text);
      }
    }, [active, text]);

    useEffect(() => {
      if (!active) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        cursorRef.current = text.length;
        isCompletedRef.current = true;
        setDisplayedText(text);
        return;
      }

      if (isCompletedRef.current) {
        return;
      }

      if (intervalRef.current) {
        return;
      }

      intervalRef.current = window.setInterval(() => {
        const nextCursor = Math.min(cursorRef.current + 1, text.length);
        if (nextCursor === cursorRef.current) {
          return;
        }

        cursorRef.current = nextCursor;
        setDisplayedText(text.slice(0, nextCursor));
        latestOnProgressRef.current?.();

        if (nextCursor >= text.length) {
          isCompletedRef.current = true;
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, speed);

      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [active, speed, text]);

    return <p className="whitespace-pre-wrap">{displayedText}</p>;
  },
  (prev, next) =>
    prev.text === next.text &&
    prev.speed === next.speed &&
    prev.active === next.active
);

function TriageResultCard(props: {
  summary: string;
  onEdit: () => void;
  doctors: RecommendedDoctor[];
  isLoadingDoctors: boolean;
  doctorError: string | null;
  resolved: "en" | "zh";
  onSelectDoctor: (doctorId: number) => void;
  labels: {
    summary: string;
    recommendedDoctors: string;
    edit: string;
    selectBook: string;
    viewProfile: string;
    doctorQueryError: string;
    noDoctors: string;
    doctorPlaceholder: string;
    specialtyUnavailable: string;
  };
  onViewProfile: (doctor: RecommendedDoctor) => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-teal-200 bg-white p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <FileText className="h-4 w-4" />
          {props.labels.summary}
        </h4>
        <button
          type="button"
          onClick={props.onEdit}
          className="rounded-md px-2.5 py-1.5 text-sm text-teal-600 hover:bg-teal-50"
        >
          {props.labels.edit}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{props.summary}</p>

      <hr className="my-4 border-slate-100" />

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <Users className="h-4 w-4" />
          {props.labels.recommendedDoctors}
        </h4>

        {props.isLoadingDoctors ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : props.doctorError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              {props.labels.doctorQueryError}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              {props.doctorError}
            </p>
          </div>
        ) : props.doctors.length === 0 ? (
          <p className="text-sm text-slate-500">{props.labels.noDoctors}</p>
        ) : (
          <div className="space-y-2">
            {props.doctors.slice(0, 3).map(item => {
              const doctorName = getLocalizedTextWithZhFallback({
                lang: props.resolved,
                value: item.doctor.name,
                placeholder: props.labels.doctorPlaceholder,
              });
              const departmentName = getLocalizedTextWithZhFallback({
                lang: props.resolved,
                value: item.department.name,
              });
              const titleText = getLocalizedTextWithZhFallback({
                lang: props.resolved,
                value: item.title,
                placeholder: props.labels.doctorPlaceholder,
              });
              const specialtyText = getLocalizedTextWithZhFallback({
                lang: props.resolved,
                value: item.specialty,
                placeholder: props.labels.specialtyUnavailable,
              });

              return (
                <div
                  key={item.doctor.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => props.onViewProfile(item)}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={item.doctor.imageUrl ?? undefined} alt={doctorName} />
                        <AvatarFallback>{doctorName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{doctorName}</p>
                      <p className="mt-1 inline-flex w-fit rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                        {titleText}
                      </p>
                      <Badge className="mt-1 ml-1 rounded-full border-0 bg-emerald-50 text-emerald-700">
                        {departmentName}
                      </Badge>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-600">{specialtyText}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 text-slate-700"
                      onClick={() => props.onViewProfile(item)}
                    >
                      <Eye className="h-4 w-4" />
                      {props.labels.viewProfile}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                      onClick={() => props.onSelectDoctor(item.doctor.id)}
                    >
                      {props.labels.selectBook}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AITriageChat({ onSelectDoctor }: AITriageChatProps) {
  const [, setLocation] = useLocation();
  const { resolved, reportInput } = useLanguage();
  const t = getTriageCopy(resolved);
  const { openLoginModal, user } = useAuth();
  const {
    messages,
    input,
    triageResult,
    triageSessionId,
    requestError,
    disclaimerOpen,
    quotaDialogOpen,
    quotaMessage,
    messageLimitReached,
    reportGenerationLocked,
    bookingOpen,
    bookingDoctorId,
    listEndRef,
    createSessionMutation,
    sendMessageMutation,
    recommendQuery,
    applyEditedSummary,
    setInput,
    setBookingOpen,
    setDisclaimerOpen,
    setQuotaDialogOpen,
    resetSession,
    handleSend,
    handleAcceptDisclaimer,
    handleInputKeyDown,
    openBookingDialog,
  } = useTriageChat({ resolved, reportInput });

  const [leftOpen, setLeftOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [isEditSummaryOpen, setIsEditSummaryOpen] = useState(false);
  const [profileDoctor, setProfileDoctor] = useState<RecommendedDoctor | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [animatedAssistantSignature, setAnimatedAssistantSignature] = useState<string | null>(
    null
  );
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const previousRenderedMessagesRef = useRef<TriageDisplayMessage[] | null>(null);

  const historyQuery = trpc.consultation.getHistory.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const historyMessagesQuery = trpc.consultation.getMessagesBySessionId.useQuery(
    { sessionId: activeSessionId ?? 0 },
    {
      enabled: !!activeSessionId,
      staleTime: 5 * 60 * 1000,
    }
  );

  const isChatPending = createSessionMutation.isPending || sendMessageMutation.isPending;
  const isRecommendationPending =
    triageResult?.isComplete === true && recommendQuery.isFetching;
  const patientName = user?.name || user?.email || t.common.unnamed_patient;

  const historyItems = useMemo<HistoryItem[]>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgoStart = new Date(todayStart);
    sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7);

    return (historyQuery.data ?? []).map(session => {
      const createdAt = new Date(session.createdAt);
      let group: HistoryItem["group"] = "older";

      if (!Number.isNaN(createdAt.getTime())) {
        if (createdAt >= todayStart) {
          group = "today";
        } else if (createdAt >= sevenDaysAgoStart) {
          group = "previous7";
        }
      }

      return {
        id: session.id,
        title: session.title,
        status: session.status,
        group,
      };
    });
  }, [historyQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawId = new URLSearchParams(window.location.search).get("id");
    const parsedId = Number(rawId ?? NaN);
    if (Number.isInteger(parsedId) && parsedId > 0) {
      setActiveSessionId(parsedId);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    const targetExists = historyItems.some(item => item.id === activeSessionId);
    if (!targetExists) {
      setActiveSessionId(null);
      setLocation("/triage");
    }
  }, [activeSessionId, historyItems, setLocation]);

  useEffect(() => {
    if (!quotaDialogOpen) return;
    toast.error(quotaMessage || t.status.quota_login_required);
    openLoginModal();
    setQuotaDialogOpen(false);
  }, [openLoginModal, quotaDialogOpen, quotaMessage, setQuotaDialogOpen, t.status.quota_login_required]);

  useEffect(() => {
    setSummaryDraft(triageResult?.summary || "");
  }, [triageResult?.summary]);

  const selectedHistorySession =
    activeSessionId === null
      ? null
      : historyItems.find(item => item.id === activeSessionId) ?? null;
  const isHistoryReadOnly = activeSessionId !== null;
  const isReadOnlyMode =
    isHistoryReadOnly ||
    selectedHistorySession?.status === "completed" ||
    triageResult?.isComplete === true ||
    reportGenerationLocked ||
    messageLimitReached;
  const isInputDisabled = isReadOnlyMode || isRecommendationPending;

  const displayMessages: TriageDisplayMessage[] = isHistoryReadOnly
    ? (historyMessagesQuery.data ?? []).map(message => ({
        role: message.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }))
    : messages;

  const renderedMessages = useMemo(() => {
    if (isHistoryReadOnly || !triageResult?.isComplete || displayMessages.length === 0) {
      return displayMessages;
    }

    const lastIndex = displayMessages.length - 1;
    return displayMessages.filter(
      (message, index) => !(index === lastIndex && message.role === "assistant")
    );
  }, [displayMessages, isHistoryReadOnly, triageResult?.isComplete]);

  const inputPlaceholder = isHistoryReadOnly
    ? t.sidebar.read_only_placeholder
    : reportGenerationLocked
      ? t.status.reviewing
    : isRecommendationPending
      ? t.searching
    : isChatPending
      ? t.status.thinking
      : t.placeholder;

  const activityLabel = reportGenerationLocked
    ? t.status.reviewing
    : isRecommendationPending
      ? t.searching
      : isChatPending
        ? t.status.thinking
        : null;

  const effectiveSummary =
    summaryDraft.trim().length > 0
      ? summaryDraft.trim()
      : triageResult?.summary?.trim() || t.common.no_summary_available;
  const localizedInterruptionDetail =
    triageResult?.interrupted && triageResult.reply
      ? getLocalizedInterruptionDetail({
          lang: resolved,
          message: triageResult.interruptionMessage,
          riskCodes: triageResult.riskCodes,
          fallback: triageResult.reply,
        })
      : null;

  const recommendedDoctors = (recommendQuery.data ?? []) as RecommendedDoctor[];
  const doctorRecommendationError = recommendQuery.isError
    ? recommendQuery.error.message
    : null;
  const profileDoctorName = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: profileDoctor?.doctor.name,
    placeholder: t.doctorFallback,
  });
  const profileDoctorTitle = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: profileDoctor?.title,
    placeholder: t.common.doctor_placeholder,
  });
  const profileDoctorSpecialty = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: profileDoctor?.specialty,
    placeholder: t.common.specialty_unavailable,
  });
  const profileDoctorBiography = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: profileDoctor?.biography,
    placeholder: t.noBio,
  });

  const todayItems = historyItems.filter(item => item.group === "today");
  const previousItems = historyItems.filter(item => item.group === "previous7");
  const olderItems = historyItems.filter(item => item.group === "older");
  const currentSessionListItem = useMemo<HistoryItem | null>(() => {
    if (activeSessionId !== null) {
      return null;
    }
    if (!triageSessionId || messages.length <= 1) {
      return null;
    }

    const numericSessionId = Number(triageSessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      return null;
    }

    return {
      id: numericSessionId,
        title: buildCurrentSessionSidebarTitle({
          messages,
          triageResult,
          fallbackTitle: t.sidebar.new_session,
        }),
      status: triageResult?.isComplete ? "completed" : "active",
      group: "today",
    };
  }, [activeSessionId, messages, resolved, triageResult, triageSessionId]);
  const mergedTodayItems = useMemo(() => {
    if (!currentSessionListItem) {
      return todayItems;
    }

    return [currentSessionListItem, ...todayItems.filter(item => item.id !== currentSessionListItem.id)];
  }, [currentSessionListItem, todayItems]);

  const scrollToBottom = useCallback(() => {
    if (!messageStreamRef.current) return;
    messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    const nextSignature = resolveAnimatedAssistantSignature({
      previousMessages: previousRenderedMessagesRef.current,
      nextMessages: renderedMessages,
      isHistoryReadOnly,
    });

    if (nextSignature) {
      setAnimatedAssistantSignature(nextSignature);
    } else {
      const latestRole = renderedMessages[renderedMessages.length - 1]?.role;
      if (isHistoryReadOnly || renderedMessages.length === 0 || latestRole === "user") {
        setAnimatedAssistantSignature(null);
      }
    }

    previousRenderedMessagesRef.current = renderedMessages;
  }, [isHistoryReadOnly, renderedMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [renderedMessages.length, historyMessagesQuery.data?.length, triageResult?.isComplete]);

  const handleSaveSummary = () => {
    const normalizedSummary = summaryDraft.trim();
    if (normalizedSummary.length > 0) {
      applyEditedSummary(normalizedSummary);
      void recommendQuery.refetch();
    }
    setIsEditSummaryOpen(false);
  };

  return (
    <>
      <div className="relative flex h-full w-full overflow-hidden bg-slate-50">
        <aside
          className={`h-full flex-shrink-0 overflow-hidden bg-slate-50 transition-[width] duration-300 ease-in-out ${
            leftOpen ? "w-[260px] border-r border-slate-200/60" : "w-0 border-none"
          }`}
        >
          <div className="flex h-full w-[260px] flex-col whitespace-nowrap p-4">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetSession();
                  setActiveSessionId(null);
                  setLocation("/triage");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                {t.sidebar.new_session}
              </button>
              <button
                type="button"
                onClick={() => setLeftOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto">
              <div>
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t.sidebar.today}
                </p>
                {historyQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                    <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                    <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                    <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                  </div>
                ) : historyQuery.error ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
                    {t.sidebar.load_failed}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {mergedTodayItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(item.id);
                          setLocation(`/triage?id=${item.id}`);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                          activeSessionId === item.id
                            ? "bg-teal-100/80 text-teal-800"
                            : "text-slate-700 hover:bg-slate-100/70"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!historyQuery.isLoading && (
                <div>
                  <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t.sidebar.previous_7_days}
                  </p>
                  <div className="space-y-1">
                    {previousItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(item.id);
                          setLocation(`/triage?id=${item.id}`);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                          activeSessionId === item.id
                            ? "bg-teal-100/80 text-teal-800"
                            : "text-slate-700 hover:bg-slate-100/70"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!historyQuery.isLoading && (
                <div>
                  <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t.sidebar.older}
                  </p>
                  <div className="space-y-1">
                    {olderItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(item.id);
                          setLocation(`/triage?id=${item.id}`);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                          activeSessionId === item.id
                            ? "bg-teal-100/80 text-teal-800"
                            : "text-slate-700 hover:bg-slate-100/70"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!historyQuery.isLoading && historyItems.length === 0 && (
                <div className="flex h-full items-center justify-center px-2 py-8">
                  <p className="text-center text-sm text-slate-500">{t.sidebar.empty}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="relative flex h-full min-w-0 flex-1 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
            <div className="flex items-center gap-2">
              {!leftOpen && (
                <button
                  type="button"
                  onClick={() => setLeftOpen(true)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <p className="text-sm font-medium text-slate-900">
                {t.patientLabel}: {patientName}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6" ref={messageStreamRef}>
            <div className="mx-auto w-full max-w-3xl">
              <div className="flex w-full flex-col space-y-8">
                {isHistoryReadOnly && historyMessagesQuery.isLoading ? (
                  <>
                    <Skeleton className="h-16 w-[75%] rounded-2xl" />
                    <Skeleton className="ml-auto h-16 w-[70%] rounded-2xl" />
                    <Skeleton className="h-16 w-[78%] rounded-2xl" />
                  </>
                ) : renderedMessages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {isHistoryReadOnly ? t.sidebar.no_messages_in_session : t.initialAssistantMessage}
                  </p>
                ) : (
                  renderedMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={getMessageContainerClass(message.role)}>
                        <div
                          className={
                            message.role === "user"
                              ? "relative rounded-2xl bg-teal-600 p-4 text-sm leading-relaxed text-white before:absolute before:right-[-6px] before:top-3 before:h-3 before:w-3 before:rotate-45 before:bg-teal-600"
                              : "relative rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 before:absolute before:left-[-6px] before:top-3 before:h-3 before:w-3 before:rotate-45 before:border-l before:border-t before:border-slate-100 before:bg-slate-50"
                          }
                        >
                          <TypewriterMessage
                            text={message.content}
                            speed={20}
                            active={
                              !isHistoryReadOnly &&
                              message.role === "assistant" &&
                              getAssistantMessageSignature(message, index) ===
                                animatedAssistantSignature
                            }
                            onProgress={scrollToBottom}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {!isHistoryReadOnly && triageResult?.isComplete && (
                  <div className={getTriageResultContainerClass()}>
                    <div className="w-full max-w-[85%]">
                      {triageResult.interrupted ? (
                        <div className="overflow-hidden rounded-[28px] border border-rose-200/80 bg-[linear-gradient(145deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))] shadow-[0_18px_40px_-24px_rgba(225,29,72,0.55)]">
                          <div className="border-b border-rose-200/70 bg-white/55 px-5 py-4 backdrop-blur">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-2xl bg-rose-600 p-2 text-white shadow-sm">
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">
                                  {t.interruption.eyebrow}
                                </p>
                                <h4 className="text-lg font-semibold text-rose-900">
                                  {t.interruption.title}
                                </h4>
                                <p className="text-sm leading-relaxed text-rose-700">
                                  {t.interruption.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-5 p-5">
                            <div className="rounded-2xl border border-rose-100 bg-white/80 p-4">
                              <p className="mb-2 text-sm font-medium text-rose-900">
                                {t.interruption.next_steps_title}
                              </p>
                              <ul className="space-y-2 text-sm leading-relaxed text-rose-800">
                                {t.interruption.next_steps.map(step => (
                                  <li key={step} className="flex gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="rounded-2xl border border-rose-100 bg-rose-100/70 p-4">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-700">
                                {localizedInterruptionDetail}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <Button
                                className="bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                                onClick={() => setLocation("/hospitals")}
                              >
                                {t.interruption.primary_cta}
                              </Button>
                              <Button
                                variant="outline"
                                className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                onClick={() => setLocation("/")}
                              >
                                {t.interruption.secondary_cta}
                              </Button>
                            </div>

                            <p className="text-xs leading-relaxed text-rose-500">
                              {t.interruption.footer}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <TriageResultCard
                          summary={effectiveSummary}
                          onEdit={() => setIsEditSummaryOpen(true)}
                          doctors={recommendedDoctors}
                          isLoadingDoctors={recommendQuery.isFetching}
                          doctorError={doctorRecommendationError}
                          resolved={resolved}
                          labels={{
                            summary: t.triage_card.summary,
                            recommendedDoctors: t.triage_card.recommended_doctors,
                            edit: t.common.edit,
                            selectBook: t.common.select_book,
                            viewProfile: t.common.view_profile,
                            doctorQueryError: t.doctorQueryError,
                            noDoctors: t.noDoctor,
                            doctorPlaceholder: t.common.doctor_placeholder,
                            specialtyUnavailable: t.common.specialty_unavailable,
                          }}
                          onViewProfile={doctor => setProfileDoctor(doctor)}
                          onSelectDoctor={doctorId => {
                            onSelectDoctor?.({
                              doctorId,
                              summary: effectiveSummary,
                              keywords: triageResult?.keywords ?? [],
                            });
                            openBookingDialog(doctorId);
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {activityLabel && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {activityLabel}
                  </div>
                )}
                <div ref={listEndRef} />
              </div>
            </div>
          </div>

          <div className="mt-auto px-4">
            {requestError && (
              <p className="mx-auto mb-3 w-full max-w-3xl rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {requestError}
              </p>
            )}

            <div className="mx-auto mb-6 w-full max-w-3xl">
              <div
                className={`relative flex items-end overflow-hidden rounded-3xl border shadow-md ${
                  isReadOnlyMode
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-80"
                    : "border-slate-200 bg-white focus-within:border-teal-500"
                }`}
              >
                <Textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={inputPlaceholder}
                  disabled={isInputDisabled}
                  className="max-h-32 min-h-[64px] w-full resize-none border-0 bg-transparent py-4 pl-5 pr-16 text-slate-800 outline-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isInputDisabled || !input.trim() || isChatPending}
                  className={`absolute bottom-3 right-3 rounded-xl p-2 text-white transition-colors ${
                    isInputDisabled || isChatPending
                      ? "cursor-not-allowed bg-slate-300 text-slate-300"
                      : "bg-teal-600 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <DisclaimerNotice text={t.triage.disclaimer} className="mx-4 mt-3" />
            </div>

            {messageLimitReached && (
              <div className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-amber-900">
                  {t.status.message_limit_reached}
                </p>
                <Link href="/hospitals">
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    {t.status.message_limit_action}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      <DisclaimerDialog
        open={disclaimerOpen}
        onOpenChange={setDisclaimerOpen}
        title={t.disclaimerTitle}
        description={t.disclaimerDesc}
        cancelText={t.cancel}
        confirmText={t.understand}
        onConfirm={handleAcceptDisclaimer}
        icon="info"
      >
        <p>{t.disclaimerLine1}</p>
        <p>{t.disclaimerLine2}</p>
      </DisclaimerDialog>

      <Dialog open={isEditSummaryOpen} onOpenChange={setIsEditSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.triage_card.edit_title}</DialogTitle>
            <DialogDescription>{t.triage_card.edit_desc}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={summaryDraft}
            onChange={event => setSummaryDraft(event.target.value)}
            className="min-h-[220px] resize-none focus-visible:ring-2 focus-visible:ring-teal-500"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSummaryOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveSummary}
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(profileDoctor)} onOpenChange={open => !open && setProfileDoctor(null)}>
        <DialogContent>
          {profileDoctor ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarImage
                      src={profileDoctor.doctor.imageUrl ?? undefined}
                      alt={profileDoctorName}
                    />
                    <AvatarFallback>
                      {profileDoctorName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>
                      {profileDoctorName}
                    </DialogTitle>
                    <p className="mt-1 inline-flex rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                      {profileDoctorTitle}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <User className="h-4 w-4" />
                    {t.doctor_detail.about}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {profileDoctorSpecialty}
                    {typeof profileDoctor.yearsOfExperience === "number"
                      ? ` · ${t.doctor_detail.years_experience(
                          profileDoctor.yearsOfExperience
                        )}`
                      : ""}
                  </p>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-slate-900">
                    {t.doctor_detail.biography}
                  </h4>
                  <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {profileDoctorBiography}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    onSelectDoctor?.({
                      doctorId: profileDoctor.doctor.id,
                      summary: effectiveSummary,
                      keywords: triageResult?.keywords ?? [],
                    });
                    openBookingDialog(profileDoctor.doctor.id);
                    setProfileDoctor(null);
                  }}
                >
                  {t.doctor_detail.confirm_book}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AppointmentModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        doctorId={bookingDoctorId}
        sessionId={triageSessionId || "triage-session"}
        resolved={resolved}
        triagePrefill={{
          summary: effectiveSummary,
          extraction: triageResult?.extraction,
        }}
      />
    </>
  );
}
