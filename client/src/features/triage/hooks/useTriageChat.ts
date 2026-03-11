import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getTriageCopy } from "@/features/triage/copy";
import { shouldLockInputForReportGeneration } from "@/features/triage/hooks/triageReportState";
import { TRPCClientError } from "@trpc/client";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type TriageResult = {
  isComplete: boolean;
  reply: string;
  summary?: string;
  keywords?: string[];
  extraction?: {
    symptoms: string;
    duration: string;
    age: number | null;
    gender?: string | null;
    urgency: "low" | "medium" | "high";
  };
};

type UseTriageChatParams = {
  resolved: "en" | "zh";
  reportInput: (text: string) => void;
};

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";
const TRIAGE_SESSION_KEY = "medibridge_triage_chat_v2";
const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法给出更多建议，请立即预约下方专业医生进行人工精确诊断。";

const getInitialAssistantMessage = (lang: "en" | "zh"): ChatMessage => {
  const t = getTriageCopy(lang);
  return { role: "assistant", content: t.initialAssistantMessage };
};

const detectTriageLanguage = (text: string): "en" | "zh" =>
  /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";

const isSessionAccessDeniedError = (error: TRPCClientError<any>) =>
  error.data?.code === "FORBIDDEN" &&
  typeof error.message === "string" &&
  error.message.includes("not allowed to access this triage session");

export function useTriageChat({
  resolved,
  reportInput,
}: UseTriageChatParams) {
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
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDoctorId, setBookingDoctorId] = useState<number | null>(null);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [messageLimitReached, setMessageLimitReached] = useState(false);
  const [reportGenerationLocked, setReportGenerationLocked] = useState(false);
  const sendLockRef = useRef(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const createSessionMutation = trpc.ai.createSession.useMutation();
  const sendMessageMutation = trpc.ai.sendMessage.useMutation();
  const recommendationKeywords = triageResult?.isComplete
    ? (triageResult.keywords ?? [])
    : [];

  const recommendQuery = trpc.doctors.recommend.useQuery(
    {
      keywords: recommendationKeywords,
      summary: triageResult?.summary,
      limit: 5,
    },
    {
      enabled:
        triageResult?.isComplete === true && recommendationKeywords.length > 0,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(TRIAGE_SESSION_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        triageResult?: TriageResult | null;
        input?: string;
        triageSessionId?: string;
      };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      }
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

      const restoredMessages =
        Array.isArray(parsed.messages) && parsed.messages.length > 0
          ? parsed.messages
          : [getInitialAssistantMessage(resolved)];
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
    setPendingMessage(null);
    setMessageLimitReached(false);
    setReportGenerationLocked(false);
    setQuotaDialogOpen(false);
    setQuotaMessage(null);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TRIAGE_SESSION_KEY);
    }
  };

  const sendMessage = async (content: string) => {
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
        const created = await createSessionMutation.mutateAsync();
        activeSessionId = String(created.sessionId);
        setTriageSessionId(activeSessionId);
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
        });
      } catch (error) {
        if (error instanceof TRPCClientError && isSessionAccessDeniedError(error)) {
          const recreated = await createSessionMutation.mutateAsync();
          const refreshedSessionId = String(recreated.sessionId);
          setTriageSessionId(refreshedSessionId);
          result = await sendMessageMutation.mutateAsync({
            sessionId: Number(refreshedSessionId),
            content,
            lang: resolved,
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
          urgency: "low" | "medium" | "high";
        };
        hitMessageLimit?: boolean;
      };

      const safeReply =
        typeof normalizedResult.reply === "string" &&
        normalizedResult.reply.trim().length > 0
          ? normalizedResult.reply.trim()
          : inputText.fallbackReply;
      const hitLimit =
        normalizedResult.hitMessageLimit === true ||
        safeReply.includes(SESSION_LIMIT_REPLY);
      const nextMessagesWithReply: ChatMessage[] = [...nextMessages, { role: "assistant", content: safeReply }];
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
    const isLoading = createSessionMutation.isPending || sendMessageMutation.isPending;
    const content = input.trim();
    if (isLoading || sendLockRef.current || !content) return;

    sendLockRef.current = true;

    try {
      if (!disclaimerAccepted) {
        setPendingMessage(content);
        setDisclaimerOpen(true);
        return;
      }

      await sendMessage(content);
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

    if (!pendingMessage) return;
    const content = pendingMessage;
    setPendingMessage(null);
    await sendMessage(content);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const isLoading = createSessionMutation.isPending || sendMessageMutation.isPending;
      if (isLoading || sendLockRef.current) return;
      void handleSend();
    }
  };

  const openBookingDialog = (doctorId: number) => {
    setBookingDoctorId(doctorId);
    setBookingOpen(true);
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
    bookingOpen,
    bookingDoctorId,
    listEndRef,
    createSessionMutation,
    sendMessageMutation,
    recommendQuery,
    setInput,
    setBookingOpen,
    setDisclaimerOpen,
    setQuotaDialogOpen,
    resetSession,
    handleSend,
    handleAcceptDisclaimer,
    handleInputKeyDown,
    openBookingDialog,
  };
}
