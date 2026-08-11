import { getLocalizedInterruptionDetail, type getTriageCopy } from "../copy";
import type { TriageResult, ChatMessage } from "../hooks/useTriageChat";
import {
  buildLightTriageResultFormDefaults,
  buildLightTriageResultSummary,
  type LightTriageResultForm,
} from "@shared/triageRouting";
import type { TriageDisplayMessage } from "./aiTriageMessagePresentation";
import type { TriageHistoryItem } from "./TriageHistorySidebar";
import { buildPrimaryReferralEntryHref } from "./triageReferralNavigation";

type TriageCopy = ReturnType<typeof getTriageCopy>;

type HistoryTriageData = {
  messages: Array<{ role: string; content: string }>;
  summary?: string | null;
  triageResult?: TriageResult | null;
} | null;

export const hasLightResultFormContent = (draft: LightTriageResultForm) =>
  Object.values(draft).some(value => value.trim().length > 0);

const parsePositiveSessionId = (sessionId: string) => {
  const parsedSessionId = Number(sessionId);
  return Number.isInteger(parsedSessionId) && parsedSessionId > 0
    ? parsedSessionId
    : 0;
};

export function buildTriageChatViewModel(input: {
  activeSessionId: number | null;
  historyItems: TriageHistoryItem[];
  historyData: HistoryTriageData;
  messages: ChatMessage[];
  triageResult: TriageResult | null;
  triageSessionId: string;
  resultFormDraft: LightTriageResultForm;
  resolved: "zh" | "en";
  reportGenerationLocked: boolean;
  messageLimitReached: boolean;
  isChatPending: boolean;
  copy: TriageCopy;
}) {
  const isHistoryReadOnly = input.activeSessionId !== null;
  const historyTriageResult = input.historyData?.triageResult ?? null;
  const historySummary = input.historyData?.summary ?? null;
  const selectedHistorySession = isHistoryReadOnly
    ? (input.historyItems.find(item => item.id === input.activeSessionId) ??
      null)
    : null;
  const displayedTriageResult = isHistoryReadOnly
    ? historyTriageResult
    : input.triageResult;
  const displayedTriageSessionId = isHistoryReadOnly
    ? (input.activeSessionId ?? 0)
    : parsePositiveSessionId(input.triageSessionId);
  const isInputDisabled =
    isHistoryReadOnly ||
    selectedHistorySession?.status === "completed" ||
    input.triageResult?.isComplete === true ||
    input.reportGenerationLocked ||
    input.messageLimitReached;

  const displayMessages: TriageDisplayMessage[] = isHistoryReadOnly
    ? (input.historyData?.messages ?? []).map(message => ({
        role:
          message.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }))
    : input.messages;
  const renderedMessages =
    displayedTriageResult?.isComplete && displayMessages.length > 0
      ? displayMessages.filter(
          (message, index) =>
            !(
              index === displayMessages.length - 1 &&
              message.role === "assistant"
            )
        )
      : displayMessages;

  const inputPlaceholder = isHistoryReadOnly
    ? input.copy.sidebar.read_only_placeholder
    : input.reportGenerationLocked
      ? input.copy.status.reviewing
      : input.isChatPending
        ? input.copy.status.thinking
        : input.copy.placeholder;
  const activityLabel = input.reportGenerationLocked
    ? input.copy.status.reviewing
    : input.isChatPending
      ? input.copy.status.thinking
      : null;

  const historyResultFormDraft = buildLightTriageResultFormDefaults({
    summary: historyTriageResult?.summary ?? historySummary,
    extraction: historyTriageResult?.extraction,
  });
  const displayedResultFormDraft = isHistoryReadOnly
    ? historyResultFormDraft
    : input.resultFormDraft;
  const effectiveSummary =
    displayedTriageResult?.isComplete === true
      ? hasLightResultFormContent(displayedResultFormDraft)
        ? buildLightTriageResultSummary(
            displayedResultFormDraft,
            input.resolved
          )
        : displayedTriageResult.summary?.trim() ||
          historySummary?.trim() ||
          input.copy.common.no_summary_available
      : displayedTriageResult?.summary?.trim() ||
        historySummary?.trim() ||
        input.copy.common.no_summary_available;
  const localizedInterruptionDetail =
    displayedTriageResult?.interrupted && displayedTriageResult.reply
      ? getLocalizedInterruptionDetail({
          lang: input.resolved,
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
          title: input.copy.triage_card.reduced_confidence_title,
          description: input.copy.triage_card.reduced_confidence_description(
            displayedTriageResult.routing.missingCriticalFields.map(
              field => input.copy.triage_card.critical_field_labels[field]
            )
          ),
        }
      : null;

  return {
    isHistoryReadOnly,
    displayedTriageResult,
    displayedTriageSessionId,
    isInputDisabled,
    renderedMessages,
    inputPlaceholder,
    activityLabel,
    displayedResultFormDraft,
    effectiveSummary,
    localizedInterruptionDetail,
    primaryReferralEntryHref,
    routingSafetyNotice,
    showReferralNextStepGuidance:
      displayedTriageResult?.isComplete === true &&
      displayedTriageResult.interrupted !== true,
  };
}
