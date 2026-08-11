import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileText,
  Loader2,
  MessageSquare,
  MapPinned,
  PanelLeft,
  PanelLeftOpen,
  Plus,
  Send,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DisclaimerDialog,
  DisclaimerNotice,
} from "@/components/disclaimer/DisclaimerDialog";
import {
  useTriageChat,
  type TriageResult as ChatTriageResult,
} from "@/features/triage/hooks/useTriageChat";
import {
  getLocalizedInterruptionDetail,
  getLocalizedTriageText,
  getTriageCopy,
} from "@/features/triage/copy";
import {
  getAssistantMessageSignature,
  getMessageContainerClass,
  getTriageResultContainerClass,
  resolveAnimatedAssistantSignature,
  type TriageDisplayMessage,
} from "@/features/triage/components/aiTriageMessagePresentation";
import { useAuth } from "@/features/auth";
import { trpc } from "@/lib/trpc";
import {
  buildLightTriageResultFormDefaults,
  buildLightTriageResultSummary,
  EMPTY_LIGHT_TRIAGE_RESULT_FORM,
  type LightTriageResultForm,
  type TriageRoutingHospital,
} from "@shared/triageRouting";
import { buildReferralSelectionHref } from "@/features/referrals";

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

  const firstUserMessage = input.messages
    .find(message => message.role === "user")
    ?.content?.trim();
  if (firstUserMessage) {
    return firstUserMessage.replace(/\s+/g, " ").slice(0, 255);
  }

  return input.fallbackTitle;
};

const hasLightResultFormContent = (draft: LightTriageResultForm) =>
  Object.values(draft).some(value => value.trim().length > 0);

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

function buildReferralSelectionLink(input: {
  triageSessionId: number;
  hospital: TriageRoutingHospital;
  rankedHospitalIndex: number;
}) {
  if (input.triageSessionId <= 0) {
    return "/triage";
  }

  return buildReferralSelectionHref({
    triageSessionId: input.triageSessionId,
    rankedHospitalIndex: input.rankedHospitalIndex,
    hospitalId: input.hospital.matchedHospitalId ?? undefined,
  });
}

function buildPrimaryReferralEntryHref(input: {
  triageSessionId: number;
  hospitals: TriageRoutingHospital[];
}) {
  for (
    let rankedHospitalIndex = 0;
    rankedHospitalIndex < input.hospitals.length;
    rankedHospitalIndex += 1
  ) {
    const hospital = input.hospitals[rankedHospitalIndex];
    const href = buildReferralSelectionLink({
      triageSessionId: input.triageSessionId,
      hospital,
      rankedHospitalIndex,
    });
    if (href) {
      return href;
    }
  }

  return "/triage";
}

function HospitalRoutingCard(props: {
  triageSessionId: number;
  summary: string;
  possibilitySummary: string;
  recommendedDepartment: string;
  hospitals: TriageRoutingHospital[];
  safetyNotice?: {
    title: string;
    description: string;
  } | null;
  labels: {
    summary: string;
    possibility: string;
    department: string;
    recommendedHospitals: string;
    notDiagnosis: string;
    browseHospital: string;
    nextStepTitle: string;
    nextStepDescription: string;
    platformMatch: string;
    manualCoordination: string;
    noHospitals: string;
  };
}) {
  return (
    <div className="w-full rounded-2xl border border-teal-200 bg-white p-5 shadow-md">
      <div className="space-y-5">
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileText className="h-4 w-4" />
            {props.labels.summary}
          </h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {props.summary}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Stethoscope className="h-4 w-4 text-teal-600" />
              {props.labels.possibility}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {props.possibilitySummary}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {props.labels.notDiagnosis}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-teal-50/70 p-4">
            <p className="text-sm font-medium text-slate-900">
              {props.labels.department}
            </p>
            <Badge className="mt-3 rounded-full border-0 bg-teal-600 px-3 py-1 text-white">
              {props.recommendedDepartment}
            </Badge>
          </div>
        </div>

        {props.safetyNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {props.safetyNotice.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              {props.safetyNotice.description}
            </p>
          </div>
        ) : null}

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Building2 className="h-4 w-4" />
            {props.labels.recommendedHospitals}
          </h4>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/90 p-2 text-teal-600 shadow-sm">
                <MapPinned className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-900">
                  {props.labels.nextStepTitle}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-teal-800">
                  {props.labels.nextStepDescription}
                </p>
              </div>
            </div>
          </div>

          {props.hospitals.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {props.labels.noHospitals}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {props.hospitals.map((hospital, index) => {
                const referralHref = buildReferralSelectionLink({
                  triageSessionId: props.triageSessionId,
                  hospital,
                  rankedHospitalIndex: index,
                });
                const content = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {hospital.hospitalName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {hospital.specialtyRank !== null ? (
                            <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">
                              #{hospital.specialtyRank}
                            </Badge>
                          ) : null}
                          {hospital.generalGrade ? (
                            <Badge className="rounded-full border-0 bg-sky-50 text-sky-700">
                              {hospital.generalGrade}
                            </Badge>
                          ) : null}
                          {hospital.stemRank !== null ? (
                            <Badge className="rounded-full border-0 bg-amber-50 text-amber-700">
                              STEM #{hospital.stemRank}
                            </Badge>
                          ) : null}
                          {hospital.matchedHospitalId ? (
                            <Badge className="rounded-full border-0 bg-violet-50 text-violet-700">
                              {props.labels.platformMatch}
                            </Badge>
                          ) : (
                            <Badge className="rounded-full border-0 bg-teal-50 text-teal-700">
                              {props.labels.manualCoordination}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {hospital.reason}
                    </p>
                    {hospital.city ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {hospital.city}
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">
                      <span>{props.labels.browseHospital}</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </>
                );

                return (
                  <Link
                    key={`${hospital.hospitalName}-${index}`}
                    href={referralHref}
                    className="group block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LightSummaryFormCard(props: {
  draft: LightTriageResultForm;
  onChange: <K extends keyof LightTriageResultForm>(
    key: K,
    value: LightTriageResultForm[K]
  ) => void;
  readOnly?: boolean;
  labels: {
    title: string;
    description: string;
    ageGender: string;
    mainSymptomAndLocation: string;
    durationAndOnset: string;
    traumaOrSurgery: string;
    medicalHistory: string;
    otherSymptoms: string;
  };
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-slate-900">
          {props.labels.title}
        </h4>
        <p className="mt-1 text-sm text-slate-500">
          {props.labels.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="triage-summary-age-gender">
            {props.labels.ageGender}
          </Label>
          <Input
            id="triage-summary-age-gender"
            value={props.draft.ageGender}
            onChange={event => props.onChange("ageGender", event.target.value)}
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-duration">
            {props.labels.durationAndOnset}
          </Label>
          <Input
            id="triage-summary-duration"
            value={props.draft.durationAndOnset}
            onChange={event =>
              props.onChange("durationAndOnset", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="triage-summary-symptom">
            {props.labels.mainSymptomAndLocation}
          </Label>
          <Textarea
            id="triage-summary-symptom"
            value={props.draft.mainSymptomAndLocation}
            onChange={event =>
              props.onChange("mainSymptomAndLocation", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2 min-h-[88px]"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-trauma">
            {props.labels.traumaOrSurgery}
          </Label>
          <Input
            id="triage-summary-trauma"
            value={props.draft.traumaOrSurgery}
            onChange={event =>
              props.onChange("traumaOrSurgery", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-history">
            {props.labels.medicalHistory}
          </Label>
          <Input
            id="triage-summary-history"
            value={props.draft.medicalHistory}
            onChange={event =>
              props.onChange("medicalHistory", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="triage-summary-other">
            {props.labels.otherSymptoms}
          </Label>
          <Textarea
            id="triage-summary-other"
            value={props.draft.otherSymptoms}
            onChange={event =>
              props.onChange("otherSymptoms", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2 min-h-[88px]"
          />
        </div>
      </div>
    </div>
  );
}

export default function AITriageChat() {
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
    listEndRef,
    createSessionMutation,
    sendMessageMutation,
    applyEditedSummary,
    setInput,
    setDisclaimerOpen,
    setQuotaDialogOpen,
    resetSession,
    handleSend,
    handleAcceptDisclaimer,
    handleInputKeyDown,
  } = useTriageChat({ resolved, reportInput });

  const [leftOpen, setLeftOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [resultFormDraft, setResultFormDraft] = useState<LightTriageResultForm>(
    EMPTY_LIGHT_TRIAGE_RESULT_FORM
  );
  const [animatedAssistantSignature, setAnimatedAssistantSignature] = useState<
    string | null
  >(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const previousRenderedMessagesRef = useRef<TriageDisplayMessage[] | null>(
    null
  );

  const historyQuery = trpc.consultation.getHistory.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const historyMessagesQuery =
    trpc.consultation.getMessagesBySessionId.useQuery(
      { sessionId: activeSessionId ?? 0 },
      {
        enabled: !!activeSessionId,
        staleTime: 5 * 60 * 1000,
      }
    );

  const isChatPending =
    createSessionMutation.isPending || sendMessageMutation.isPending;
  const patientName = user?.name || user?.email || t.common.unnamed_patient;
  const historyTriageResult: ChatTriageResult | null =
    historyMessagesQuery.data?.triageResult ?? null;
  const historySummary = historyMessagesQuery.data?.summary ?? null;

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
  }, [
    openLoginModal,
    quotaDialogOpen,
    quotaMessage,
    setQuotaDialogOpen,
    t.status.quota_login_required,
  ]);

  useEffect(() => {
    if (!triageResult?.isComplete) {
      return;
    }

    setResultFormDraft(
      buildLightTriageResultFormDefaults({
        summary: triageResult.summary,
        extraction: triageResult.extraction,
      })
    );
  }, [triageResult?.isComplete, triageSessionId]);

  const selectedHistorySession =
    activeSessionId === null
      ? null
      : (historyItems.find(item => item.id === activeSessionId) ?? null);
  const isHistoryReadOnly = activeSessionId !== null;
  const displayedTriageResult = isHistoryReadOnly
    ? historyTriageResult
    : triageResult;
  const displayedTriageSessionId = isHistoryReadOnly
    ? (activeSessionId ?? 0)
    : (() => {
        const parsedSessionId = Number(triageSessionId);
        return Number.isInteger(parsedSessionId) && parsedSessionId > 0
          ? parsedSessionId
          : 0;
      })();
  const isReadOnlyMode =
    isHistoryReadOnly ||
    selectedHistorySession?.status === "completed" ||
    triageResult?.isComplete === true ||
    reportGenerationLocked ||
    messageLimitReached;
  const isInputDisabled = isReadOnlyMode;

  const displayMessages: TriageDisplayMessage[] = isHistoryReadOnly
    ? (historyMessagesQuery.data?.messages ?? []).map(message => ({
        role:
          message.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }))
    : messages;

  const renderedMessages = useMemo(() => {
    if (!displayedTriageResult?.isComplete || displayMessages.length === 0) {
      return displayMessages;
    }

    const lastIndex = displayMessages.length - 1;
    return displayMessages.filter(
      (message, index) => !(index === lastIndex && message.role === "assistant")
    );
  }, [displayMessages, displayedTriageResult?.isComplete]);

  const inputPlaceholder = isHistoryReadOnly
    ? t.sidebar.read_only_placeholder
    : reportGenerationLocked
      ? t.status.reviewing
      : isChatPending
        ? t.status.thinking
        : t.placeholder;

  const activityLabel = reportGenerationLocked
    ? t.status.reviewing
    : isChatPending
      ? t.status.thinking
      : null;

  const historyResultFormDraft = useMemo(
    () =>
      buildLightTriageResultFormDefaults({
        summary: historyTriageResult?.summary ?? historySummary,
        extraction: historyTriageResult?.extraction,
      }),
    [
      historySummary,
      historyTriageResult?.extraction,
      historyTriageResult?.summary,
    ]
  );
  const displayedResultFormDraft = isHistoryReadOnly
    ? historyResultFormDraft
    : resultFormDraft;
  const effectiveSummary =
    displayedTriageResult?.isComplete === true
      ? hasLightResultFormContent(displayedResultFormDraft)
        ? buildLightTriageResultSummary(displayedResultFormDraft, resolved)
        : displayedTriageResult.summary?.trim() ||
          historySummary?.trim() ||
          t.common.no_summary_available
      : displayedTriageResult?.summary?.trim() ||
        historySummary?.trim() ||
        t.common.no_summary_available;
  const localizedInterruptionDetail =
    displayedTriageResult?.interrupted && displayedTriageResult.reply
      ? getLocalizedInterruptionDetail({
          lang: resolved,
          message: displayedTriageResult.interruptionMessage,
          riskCodes: displayedTriageResult.riskCodes,
          fallback: displayedTriageResult.reply,
        })
      : null;
  const primaryReferralEntryHref = buildPrimaryReferralEntryHref({
    triageSessionId: displayedTriageSessionId,
    hospitals: displayedTriageResult?.routing?.hospitals ?? [],
  });
  const routingSafetyNotice =
    displayedTriageResult?.routing?.confidence === "reduced"
      ? {
          title: t.triage_card.reduced_confidence_title,
          description: t.triage_card.reduced_confidence_description(
            displayedTriageResult.routing.missingCriticalFields.map(
              field => t.triage_card.critical_field_labels[field]
            )
          ),
        }
      : null;
  const showReferralNextStepGuidance =
    displayedTriageResult?.isComplete === true &&
    displayedTriageResult.interrupted !== true;

  useEffect(() => {
    const isFreshSession =
      !isHistoryReadOnly &&
      messages.length === 1 &&
      !triageResult &&
      !triageSessionId;

    if (isFreshSession) {
      setResultFormDraft(EMPTY_LIGHT_TRIAGE_RESULT_FORM);
    }
  }, [isHistoryReadOnly, messages.length, triageResult, triageSessionId]);

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

    return [
      currentSessionListItem,
      ...todayItems.filter(item => item.id !== currentSessionListItem.id),
    ];
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
      if (
        isHistoryReadOnly ||
        renderedMessages.length === 0 ||
        latestRole === "user"
      ) {
        setAnimatedAssistantSignature(null);
      }
    }

    previousRenderedMessagesRef.current = renderedMessages;
  }, [isHistoryReadOnly, renderedMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [
    renderedMessages.length,
    historyMessagesQuery.data?.messages.length,
    displayedTriageResult?.isComplete,
  ]);

  const updateResultFormDraft = <K extends keyof LightTriageResultForm>(
    key: K,
    value: LightTriageResultForm[K]
  ) => {
    setResultFormDraft(current => ({
      ...current,
      [key]: value,
    }));
  };

  useEffect(() => {
    if (
      !triageResult?.isComplete ||
      !hasLightResultFormContent(resultFormDraft)
    ) {
      return;
    }

    applyEditedSummary(
      buildLightTriageResultSummary(resultFormDraft, resolved)
    );
  }, [applyEditedSummary, resolved, resultFormDraft, triageResult?.isComplete]);

  return (
    <>
      <div className="relative flex h-full w-full overflow-hidden bg-slate-50">
        <aside
          className={`h-full flex-shrink-0 overflow-hidden bg-slate-50 transition-[width] duration-300 ease-in-out ${
            leftOpen
              ? "w-[260px] border-r border-slate-200/60"
              : "w-0 border-none"
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
                  <p className="text-center text-sm text-slate-500">
                    {t.sidebar.empty}
                  </p>
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
                    {isHistoryReadOnly
                      ? t.sidebar.no_messages_in_session
                      : t.initialAssistantMessage}
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

                {displayedTriageResult?.isComplete && (
                  <div className={getTriageResultContainerClass()}>
                    <div className="w-full max-w-[85%]">
                      {displayedTriageResult.interrupted ? (
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
                        <div className="space-y-4">
                          <HospitalRoutingCard
                            triageSessionId={displayedTriageSessionId}
                            summary={effectiveSummary}
                            possibilitySummary={
                              displayedTriageResult.routing
                                ?.possibilitySummary ??
                              t.triage_card.possibility_fallback
                            }
                            recommendedDepartment={getLocalizedTriageText({
                              lang: resolved,
                              text: displayedTriageResult.routing
                                ?.recommendedDepartment,
                              fallback: t.triage_card.department_fallback,
                            })}
                            hospitals={
                              displayedTriageResult.routing?.hospitals ?? []
                            }
                            safetyNotice={routingSafetyNotice}
                            labels={{
                              summary: t.triage_card.summary,
                              possibility: t.triage_card.possibility,
                              department: t.triage_card.recommended_department,
                              recommendedHospitals:
                                t.triage_card.recommended_hospitals,
                              notDiagnosis: t.triage_card.not_diagnosis,
                              browseHospital: t.triage_card.browse_hospital,
                              nextStepTitle: t.triage_card.next_step_title,
                              nextStepDescription:
                                t.triage_card.next_step_description,
                              platformMatch: t.triage_card.platform_match,
                              manualCoordination:
                                t.triage_card.manual_coordination,
                              noHospitals: t.triage_card.no_hospitals,
                            }}
                          />
                          <LightSummaryFormCard
                            draft={displayedResultFormDraft}
                            onChange={updateResultFormDraft}
                            readOnly={isHistoryReadOnly}
                            labels={{
                              title: t.summary_form.title,
                              description: t.summary_form.description,
                              ageGender: t.summary_form.age_gender,
                              mainSymptomAndLocation:
                                t.summary_form.main_symptom_and_location,
                              durationAndOnset:
                                t.summary_form.duration_and_onset,
                              traumaOrSurgery: t.summary_form.trauma_or_surgery,
                              medicalHistory: t.summary_form.medical_history,
                              otherSymptoms: t.summary_form.other_symptoms,
                            }}
                          />
                        </div>
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
              {showReferralNextStepGuidance ? (
                <div className="mb-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {t.triage.post_complete_input_title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {t.triage.post_complete_input_description}
                  </p>
                </div>
              ) : null}
              <div
                className={`relative flex items-end overflow-hidden rounded-3xl border transition-colors ${
                  showReferralNextStepGuidance
                    ? "cursor-not-allowed border-slate-200 bg-slate-50/90 shadow-sm"
                    : isReadOnlyMode
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-80 shadow-sm"
                      : "border-slate-200 bg-white shadow-md focus-within:border-teal-500"
                }`}
              >
                <Textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={inputPlaceholder}
                  disabled={isInputDisabled}
                  className={`w-full resize-none border-0 bg-transparent py-4 pl-5 pr-16 outline-none focus-visible:ring-0 ${
                    showReferralNextStepGuidance
                      ? "max-h-24 min-h-[56px] text-slate-500"
                      : "max-h-32 min-h-[64px] text-slate-800"
                  }`}
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
              <DisclaimerNotice
                text={t.triage.disclaimer}
                className="mx-4 mt-3"
              />
            </div>

            {messageLimitReached && (
              <div className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-amber-900">
                  {t.status.message_limit_reached}
                </p>
                <Link href={primaryReferralEntryHref}>
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
    </>
  );
}
