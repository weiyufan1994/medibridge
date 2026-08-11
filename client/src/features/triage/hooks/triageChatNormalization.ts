import type { TRPCClientError } from "@trpc/client";
import type { LocalizedText } from "@shared/types";
import type { TriageRouting } from "@shared/triageRouting";
import { getTriageCopy } from "../copy";
import { shouldLockInputForReportGeneration } from "./triageReportState";
import type { ChatMessage, TriageResult } from "./triageChatTypes";

const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法继续细分，请尽快查看推荐专科和医院并线下就诊。";

export const getInitialAssistantMessage = (lang: "en" | "zh"): ChatMessage => {
  const copy = getTriageCopy(lang);
  return { role: "assistant", content: copy.initialAssistantMessage };
};

export const shouldRefreshInitialAssistantMessage = (messages: ChatMessage[]) =>
  messages.length === 1 && messages[0]?.role === "assistant";

export function getLocalizedDraftMessages(
  messages: ChatMessage[] | undefined,
  lang: "en" | "zh"
) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [getInitialAssistantMessage(lang)];
  }
  if (shouldRefreshInitialAssistantMessage(messages)) {
    return [getInitialAssistantMessage(lang)];
  }
  return messages;
}

export const detectTriageLanguage = (text: string): "en" | "zh" =>
  /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";

export const isSessionAccessDeniedError = (error: TRPCClientError<any>) =>
  error.data?.code === "FORBIDDEN" &&
  typeof error.message === "string" &&
  error.message.includes("not allowed to access this triage session");

export const normalizeRouting = (value: unknown): TriageRouting | undefined => {
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

type RawTriageResult = {
  isComplete?: unknown;
  reply?: unknown;
  summary?: unknown;
  keywords?: unknown;
  extraction?: unknown;
  routing?: unknown;
  hitMessageLimit?: unknown;
  interrupted?: unknown;
  riskCodes?: unknown;
  interruptionMessage?: unknown;
};

type RawExtraction = {
  symptoms?: unknown;
  duration?: unknown;
  age?: unknown;
  gender?: unknown;
  medicalHistory?: unknown;
  traumaOrSurgery?: unknown;
  otherSymptoms?: unknown;
  urgency?: unknown;
};

const normalizeOptionalText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeExtraction = (
  value: unknown
): TriageResult["extraction"] | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const extraction = value as RawExtraction;
  if (
    typeof extraction.symptoms !== "string" ||
    typeof extraction.duration !== "string" ||
    (extraction.urgency !== "low" &&
      extraction.urgency !== "medium" &&
      extraction.urgency !== "high")
  ) {
    return undefined;
  }
  return {
    symptoms: extraction.symptoms,
    duration: extraction.duration,
    age: typeof extraction.age === "number" ? extraction.age : null,
    gender: normalizeOptionalText(extraction.gender),
    medicalHistory: normalizeOptionalText(extraction.medicalHistory),
    traumaOrSurgery: normalizeOptionalText(extraction.traumaOrSurgery),
    otherSymptoms: normalizeOptionalText(extraction.otherSymptoms),
    urgency: extraction.urgency,
  };
};

const normalizeInterruptionMessage = (
  value: unknown
): LocalizedText | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const message = value as Record<string, unknown>;
  return typeof message.zh === "string" && typeof message.en === "string"
    ? (value as LocalizedText)
    : undefined;
};

export function normalizeTriageResponse(input: {
  value: unknown;
  fallbackReply: string;
  messagesBeforeReply: ChatMessage[];
}) {
  const value = (input.value ?? {}) as RawTriageResult;
  const safeReply = normalizeOptionalText(value.reply) ?? input.fallbackReply;
  const messagesWithReply: ChatMessage[] = [
    ...input.messagesBeforeReply,
    { role: "assistant", content: safeReply },
  ];
  const result: TriageResult = {
    isComplete: Boolean(value.isComplete),
    reply: safeReply,
    interrupted: value.interrupted === true,
    riskCodes: Array.isArray(value.riskCodes)
      ? value.riskCodes.filter(
          item => typeof item === "string" && item.trim().length > 0
        )
      : undefined,
    interruptionMessage: normalizeInterruptionMessage(
      value.interruptionMessage
    ),
    summary: normalizeOptionalText(value.summary) ?? undefined,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.filter(
          item => typeof item === "string" && item.trim().length > 0
        )
      : undefined,
    routing: normalizeRouting(value.routing),
    extraction: normalizeExtraction(value.extraction),
  };

  return {
    safeReply,
    hitMessageLimit:
      value.hitMessageLimit === true || safeReply.includes(SESSION_LIMIT_REPLY),
    reportGenerationLocked: shouldLockInputForReportGeneration({
      triageResult: result,
      messages: messagesWithReply,
    }),
    result,
  };
}
