import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getTriageCopy } from "@/features/triage/copy";
import { shouldLockInputForReportGeneration } from "@/features/triage/hooks/triageReportState";
import { TRPCClientError } from "@trpc/client";
import type { LocalizedText } from "@shared/types";
import type { TriageIntake } from "@shared/triageIntake";
import type { TriageRouting } from "@shared/triageRouting";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type TriageResult = {
  isComplete: boolean;
  reply: string;
  interrupted?: boolean;
  riskCodes?: string[];
  interruptionMessage?: LocalizedText;
  summary?: string;
  keywords?: string[];
  routing?: TriageRouting;
  extraction?: {
    symptoms: string;
    duration: string;
    age: number | null;
    gender?: string | null;
    medicalHistory?: string | null;
    traumaOrSurgery?: string | null;
    otherSymptoms?: string | null;
    urgency: "low" | "medium" | "high";
  };
};

type PendingSubmission = {
  content: string;
  intake?: TriageIntake;
} | null;

type UseTriageChatParams = {
  resolved: "en" | "zh";
  reportInput: (text: string) => void;
};

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";
const TRIAGE_SESSION_KEY = "medibridge_triage_chat_v2";
const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法继续细分，请尽快查看推荐专科和医院并线下就诊。";

const getInitialAssistantMessage = (lang: "en" | "zh"): ChatMessage => {
  const t = getTriageCopy(lang);
  return { role: "assistant", content: t.initialAssistantMessage };
};

const shouldRefreshInitialAssistantMessage = (messages: ChatMessage[]) =>
  messages.length === 1 && messages[0]?.role === "assistant";

const getLocalizedDraftMessages = (
  messages: ChatMessage[] | undefined,
  lang: "en" | "zh"
) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [getInitialAssistantMessage(lang)];
  }

  if (shouldRefreshInitialAssistantMessage(messages)) {
    return [getInitialAssistantMessage(lang)];
  }

  return messages;
};

const detectTriageLanguage = (text: string): "en" | "zh" =>
  /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";

const isSessionAccessDeniedError = (error: TRPCClientError<any>) =>
  error.data?.code === "FORBIDDEN" &&
  typeof error.message === "string" &&
  error.message.includes("not allowed to access this triage session");

const normalizeRouting = (value: unknown): TriageRouting | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const recommendedDepartment = input.recommendedDepartment;
  if (
    typeof input.possibilitySummary !== "string" ||
    !recommendedDepartment ||
    typeof recommendedDepartment !== "object"
  ) {
    return undefined;
  }

  const department = recommendedDepartment as Record<string, unknown>;
  if (typeof department.zh !== "string" || typeof department.en !== "string") {
    return undefined;
  }

  const hospitals = Array.isArray(input.hospitals)
    ? input.hospitals
        .map(item => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const hospital = item as Record<string, unknown>;
          if (
            typeof hospital.hospitalName !== "string" ||
            typeof hospital.reason !== "string"
          ) {
            return null;
          }

          return {
            hospitalName: hospital.hospitalName,
            city: typeof hospital.city === "string" ? hospital.city : null,
            specialtyRank:
              typeof hospital.specialtyRank === "number"
                ? hospital.specialtyRank
                : null,
            specialtyScore:
              typeof hospital.specialtyScore === "number"
                ? hospital.specialtyScore
                : null,
            generalGrade:
              typeof hospital.generalGrade === "string"
                ? hospital.generalGrade
                : null,
            stemRank:
              typeof hospital.stemRank === "number" ? hospital.stemRank : null,
            matchedHospitalId:
              typeof hospital.matchedHospitalId === "number"
                ? hospital.matchedHospitalId
                : null,
            matchedDepartmentId:
              typeof hospital.matchedDepartmentId === "number"
                ? hospital.matchedDepartmentId
                : null,
            reason: hospital.reason,
          };
        })
        .filter(
          (hospital): hospital is TriageRouting["hospitals"][number] =>
            hospital !== null
        )
    : [];

  return {
    possibilitySummary: input.possibilitySummary,
    recommendedDepartment: {
      zh: department.zh,
      en: department.en,
      matchedSpecialtyKey:
        typeof department.matchedSpecialtyKey === "string"
          ? department.matchedSpecialtyKey
          : null,
    },
    hospitals,
    confidence: input.confidence === "reduced" ? "reduced" : "standard",
    missingCriticalFields: Array.isArray(input.missingCriticalFields)
      ? input.missingCriticalFields.filter(
          (field): field is TriageRouting["missingCriticalFields"][number] =>
            field === "age" || field === "gender"
        )
      : [],
  };
};

export function useTriageChat({ resolved, reportInput }: UseTriageChatParams) {
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<ChatMessage[]>([
    getInitialAssistantMessage(resolved),
  ]);
  const [input, setInput] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageSessionId, setTriageSessionId] = useState<string>("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISCLAIMER_KEY) === "1";
  });
  const [pendingSubmission, setPendingSubmission] =
    useState<PendingSubmission>(null);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [messageLimitReached, setMessageLimitReached] = useState(false);
  const [reportGenerationLocked, setReportGenerationLocked] = useState(false);
  const sendLockRef = useRef(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const createSessionMutation = trpc.ai.createSession.useMutation();
  const sendMessageMutation = trpc.ai.sendMessage.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(TRIAGE_SESSION_KEY);
    if (!raw) {
      setMessages(prev =>
        shouldRefreshInitialAssistantMessage(prev)
          ? [getInitialAssistantMessage(resolved)]
          : prev
      );
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        triageResult?: TriageResult | null;
        input?: string;
        triageSessionId?: string;
      };
      const restoredMessages = getLocalizedDraftMessages(
        parsed.messages,
        resolved
      );
      setMessages(restoredMessages);
      if (typeof parsed.input === "string") {
        setInput(parsed.input);
      }
      if (
        typeof parsed.triageSessionId === "string" &&
        parsed.triageSessionId.trim().length > 0
      ) {
        setTriageSessionId(parsed.triageSessionId);
      }
      if (parsed.triageResult && typeof parsed.triageResult === "object") {
        setTriageResult(parsed.triageResult);
      }

      const restoredTriageResult =
        parsed.triageResult && typeof parsed.triageResult === "object"
          ? parsed.triageResult
          : null;
      setReportGenerationLocked(
        shouldLockInputForReportGeneration({
          triageResult: restoredTriageResult,
          messages: restoredMessages,
        })
      );
    } catch {
      // Ignore invalid session cache
    }
  }, [resolved]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    sessionStorage.setItem(
      TRIAGE_SESSION_KEY,
      JSON.stringify({
        messages,
        triageResult,
        input,
        triageSessionId,
      })
    );
  }, [messages, triageResult, input, triageSessionId]);

  const pushAssistantMessage = (content: string) => {
    setMessages(prev => [...prev, { role: "assistant", content }]);
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const resetSession = () => {
    setMessages([getInitialAssistantMessage(resolved)]);
    setInput("");
    setTriageResult(null);
    setTriageSessionId("");
    setRequestError(null);
    setPendingSubmission(null);
    setMessageLimitReached(false);
    setReportGenerationLocked(false);
    setQuotaDialogOpen(false);
    setQuotaMessage(null);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TRIAGE_SESSION_KEY);
    }
  };

  const syncSessionCreationState = () => {
    void Promise.all([
      utils.consultation.getHistory.invalidate(),
      utils.auth.me.invalidate(),
    ]).catch(error => {
      console.error(
        "[AITriageChat] failed to refresh session creation state:",
        error
      );
    });
  };

  const sendMessage = async (payload: {
    content: string;
    intake?: TriageIntake;
  }) => {
    const content = payload.content.trim();
    if (
      !content ||
      sendMessageMutation.isPending ||
      createSessionMutation.isPending ||
      triageResult?.isComplete ||
      messageLimitReached ||
      reportGenerationLocked
    ) {
      return;
    }

    let activeSessionId = triageSessionId;
    if (!activeSessionId) {
      try {
        const created = await createSessionMutation.mutateAsync({
          consentAccepted: disclaimerAccepted,
          consentVersion: "stream_b_v1",
          lang: resolved,
        });
        activeSessionId = String(created.sessionId);
        setTriageSessionId(activeSessionId);
        syncSessionCreationState();
      } catch (error) {
        if (error instanceof TRPCClientError) {
          const message = error.message || "无法创建问诊会话";
          setRequestError(message);
          if (error.data?.code === "FORBIDDEN") {
            if (message.includes("游客试用额度已尽")) {
              setQuotaMessage(message);
              setQuotaDialogOpen(true);
            } else {
              toast.error(message);
            }
            return;
          }

          toast.error(message);
          return;
        }
        throw error;
      }
    }

    const numericSessionId = Number(activeSessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      setRequestError("无效会诊会话，请重新开始。");
      return;
    }

    reportInput(content);
    setRequestError(null);

    const userMessage: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    try {
      const inputLang = detectTriageLanguage(content);
      const inputText = getTriageCopy(inputLang);
      let result: Awaited<ReturnType<typeof sendMessageMutation.mutateAsync>>;

      try {
        result = await sendMessageMutation.mutateAsync({
          sessionId: numericSessionId,
          content,
          lang: resolved,
          intake: payload.intake,
        });
      } catch (error) {
        if (
          error instanceof TRPCClientError &&
          isSessionAccessDeniedError(error)
        ) {
          const recreated = await createSessionMutation.mutateAsync({
            consentAccepted: disclaimerAccepted,
            consentVersion: "stream_b_v1",
            lang: resolved,
          });
          const refreshedSessionId = String(recreated.sessionId);
          setTriageSessionId(refreshedSessionId);
          syncSessionCreationState();
          result = await sendMessageMutation.mutateAsync({
            sessionId: Number(refreshedSessionId),
            content,
            lang: resolved,
            intake: payload.intake,
          });
        } else {
          throw error;
        }
      }

      const normalizedResult = result as {
        isComplete: boolean;
        reply: string;
        summary?: string;
        keywords?: string[];
        extraction?: {
          symptoms: string;
          duration: string;
          age: number | null;
          gender?: string | null;
          medicalHistory?: string | null;
          traumaOrSurgery?: string | null;
          otherSymptoms?: string | null;
          urgency: "low" | "medium" | "high";
        };
        routing?: TriageRouting;
        hitMessageLimit?: boolean;
        interrupted?: boolean;
        riskCodes?: string[];
        interruptionMessage?: LocalizedText;
      };

      const safeReply =
        typeof normalizedResult.reply === "string" &&
        normalizedResult.reply.trim().length > 0
          ? normalizedResult.reply.trim()
          : inputText.fallbackReply;
      const hitLimit =
        normalizedResult.hitMessageLimit === true ||
        safeReply.includes(SESSION_LIMIT_REPLY);
      const nextMessagesWithReply: ChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: safeReply },
      ];
      const shouldLockForReportGeneration = shouldLockInputForReportGeneration({
        triageResult: { isComplete: Boolean(normalizedResult.isComplete) },
        messages: nextMessagesWithReply,
      });

      pushAssistantMessage(safeReply);
      setMessageLimitReached(hitLimit);
      setReportGenerationLocked(shouldLockForReportGeneration);
      setTriageResult({
        isComplete: Boolean(normalizedResult.isComplete),
        reply: safeReply,
        interrupted: normalizedResult.interrupted === true,
        riskCodes: Array.isArray(normalizedResult.riskCodes)
          ? normalizedResult.riskCodes.filter(
              item => typeof item === "string" && item.trim().length > 0
            )
          : undefined,
        interruptionMessage:
          normalizedResult.interruptionMessage &&
          typeof normalizedResult.interruptionMessage === "object" &&
          typeof normalizedResult.interruptionMessage.zh === "string" &&
          typeof normalizedResult.interruptionMessage.en === "string"
            ? normalizedResult.interruptionMessage
            : undefined,
        summary:
          typeof normalizedResult.summary === "string" &&
          normalizedResult.summary.trim().length > 0
            ? normalizedResult.summary.trim()
            : undefined,
        keywords: Array.isArray(normalizedResult.keywords)
          ? normalizedResult.keywords.filter(
              item => typeof item === "string" && item.trim().length > 0
            )
          : undefined,
        routing: normalizeRouting(normalizedResult.routing),
        extraction:
          normalizedResult.extraction &&
          typeof normalizedResult.extraction === "object" &&
          typeof normalizedResult.extraction.symptoms === "string" &&
          typeof normalizedResult.extraction.duration === "string" &&
          (normalizedResult.extraction.urgency === "low" ||
            normalizedResult.extraction.urgency === "medium" ||
            normalizedResult.extraction.urgency === "high")
            ? {
                symptoms: normalizedResult.extraction.symptoms,
                duration: normalizedResult.extraction.duration,
                age:
                  typeof normalizedResult.extraction.age === "number"
                    ? normalizedResult.extraction.age
                    : null,
                gender:
                  typeof normalizedResult.extraction.gender === "string" &&
                  normalizedResult.extraction.gender.trim().length > 0
                    ? normalizedResult.extraction.gender.trim()
                    : null,
                medicalHistory:
                  typeof normalizedResult.extraction.medicalHistory ===
                    "string" &&
                  normalizedResult.extraction.medicalHistory.trim().length > 0
                    ? normalizedResult.extraction.medicalHistory.trim()
                    : null,
                traumaOrSurgery:
                  typeof normalizedResult.extraction.traumaOrSurgery ===
                    "string" &&
                  normalizedResult.extraction.traumaOrSurgery.trim().length > 0
                    ? normalizedResult.extraction.traumaOrSurgery.trim()
                    : null,
                otherSymptoms:
                  typeof normalizedResult.extraction.otherSymptoms ===
                    "string" &&
                  normalizedResult.extraction.otherSymptoms.trim().length > 0
                    ? normalizedResult.extraction.otherSymptoms.trim()
                    : null,
                urgency: normalizedResult.extraction.urgency,
              }
            : undefined,
      });
    } catch (error) {
      console.error("[AITriageChat] sendMessage error:", error);
      const inputLang = detectTriageLanguage(content);
      const inputText = getTriageCopy(inputLang);
      if (error instanceof TRPCClientError) {
        const message = error.message || inputText.requestError;
        setRequestError(message);
        toast.error(message);
        return;
      }

      setRequestError(inputText.requestError);
      pushAssistantMessage(inputText.fallbackReply);
    }
  };

  const handleSend = async () => {
    const isLoading =
      createSessionMutation.isPending || sendMessageMutation.isPending;
    const content = input.trim();
    if (isLoading || sendLockRef.current || !content) return;

    sendLockRef.current = true;

    try {
      if (!disclaimerAccepted) {
        setPendingSubmission({ content });
        setDisclaimerOpen(true);
        return;
      }

      await sendMessage({ content });
    } finally {
      sendLockRef.current = false;
    }
  };

  const handleAcceptDisclaimer = async () => {
    setDisclaimerAccepted(true);
    setDisclaimerOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    }

    if (!pendingSubmission) return;
    const nextSubmission = pendingSubmission;
    setPendingSubmission(null);
    await sendMessage(nextSubmission);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const isLoading =
        createSessionMutation.isPending || sendMessageMutation.isPending;
      if (isLoading || sendLockRef.current) return;
      void handleSend();
    }
  };

  const applyEditedSummary = (summary: string) => {
    const normalizedSummary = summary.trim();
    if (normalizedSummary.length === 0) {
      return;
    }

    setTriageResult(prev => {
      if (!prev) {
        return prev;
      }

      if (prev.summary === normalizedSummary) {
        return prev;
      }

      return {
        ...prev,
        summary: normalizedSummary,
      };
    });
  };

  return {
    messages,
    input,
    triageResult,
    triageSessionId,
    requestError,
    disclaimerOpen,
    disclaimerAccepted,
    quotaDialogOpen,
    quotaMessage,
    messageLimitReached,
    reportGenerationLocked,
    listEndRef,
    createSessionMutation,
    sendMessageMutation,
    setInput,
    setDisclaimerOpen,
    setQuotaDialogOpen,
    applyEditedSummary,
    resetSession,
    handleSend,
    handleAcceptDisclaimer,
    handleInputKeyDown,
  };
}
