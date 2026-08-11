import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { DisclaimerDialog } from "@/components/disclaimer/DisclaimerDialog";
import { useTriageChat } from "@/features/triage/hooks/useTriageChat";
import { getTriageCopy } from "@/features/triage/copy";
import {
  resolveAnimatedAssistantSignature,
  type TriageDisplayMessage,
} from "@/features/triage/components/aiTriageMessagePresentation";
import { TriageChatComposer } from "@/features/triage/components/TriageChatComposer";
import {
  TriageHistorySidebar,
  type TriageHistoryItem,
} from "@/features/triage/components/TriageHistorySidebar";
import {
  buildCurrentSessionSidebarTitle,
  buildTriageHistoryItems,
  mergeCurrentTriageHistoryItem,
} from "@/features/triage/components/triageHistory";
import { TriageMessageStream } from "@/features/triage/components/TriageMessageStream";
import { TriageResultPanel } from "@/features/triage/components/TriageResultPanel";
import {
  buildTriageChatViewModel,
  hasLightResultFormContent,
} from "@/features/triage/components/triageChatViewModel";
import { useAuth } from "@/features/auth";
import { trpc } from "@/lib/trpc";
import {
  buildLightTriageResultFormDefaults,
  buildLightTriageResultSummary,
  EMPTY_LIGHT_TRIAGE_RESULT_FORM,
  type LightTriageResultForm,
} from "@shared/triageRouting";

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

  const historyItems = useMemo(
    () => buildTriageHistoryItems(historyQuery.data ?? []),
    [historyQuery.data]
  );

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

  const {
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
    showReferralNextStepGuidance,
  } = useMemo(
    () =>
      buildTriageChatViewModel({
        activeSessionId,
        historyItems,
        historyData: historyMessagesQuery.data ?? null,
        messages,
        triageResult,
        triageSessionId,
        resultFormDraft,
        resolved,
        reportGenerationLocked,
        messageLimitReached,
        isChatPending,
        copy: t,
      }),
    [
      activeSessionId,
      historyItems,
      historyMessagesQuery.data,
      isChatPending,
      messageLimitReached,
      messages,
      reportGenerationLocked,
      resolved,
      resultFormDraft,
      t,
      triageResult,
      triageSessionId,
    ]
  );

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
  const currentSessionListItem = useMemo<TriageHistoryItem | null>(() => {
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
  const mergedTodayItems = useMemo(
    () => mergeCurrentTriageHistoryItem(todayItems, currentSessionListItem),
    [currentSessionListItem, todayItems]
  );

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
        <TriageHistorySidebar
          open={leftOpen}
          activeSessionId={activeSessionId}
          todayItems={mergedTodayItems}
          previousItems={previousItems}
          olderItems={olderItems}
          historyCount={historyItems.length}
          isLoading={historyQuery.isLoading}
          hasError={Boolean(historyQuery.error)}
          onNewSession={() => {
            resetSession();
            setActiveSessionId(null);
            setLocation("/triage");
          }}
          onClose={() => setLeftOpen(false)}
          onSelect={sessionId => {
            setActiveSessionId(sessionId);
            setLocation(`/triage?id=${sessionId}`);
          }}
          labels={{
            newSession: t.sidebar.new_session,
            today: t.sidebar.today,
            previous7Days: t.sidebar.previous_7_days,
            older: t.sidebar.older,
            empty: t.sidebar.empty,
            loadFailed: t.sidebar.load_failed,
          }}
        />

        <section className="relative flex h-full min-w-0 flex-1 flex-col bg-white">
          <TriageMessageStream
            sidebarOpen={leftOpen}
            onOpenSidebar={() => setLeftOpen(true)}
            patientLabel={t.patientLabel}
            patientName={patientName}
            streamRef={messageStreamRef}
            listEndRef={listEndRef}
            isHistoryReadOnly={isHistoryReadOnly}
            isHistoryLoading={historyMessagesQuery.isLoading}
            messages={renderedMessages}
            animatedAssistantSignature={animatedAssistantSignature}
            onTypewriterProgress={scrollToBottom}
            emptyHistoryLabel={t.sidebar.no_messages_in_session}
            emptyLiveLabel={t.initialAssistantMessage}
            activityLabel={activityLabel}
            resultPanel={
              <TriageResultPanel
                result={displayedTriageResult}
                resolved={resolved}
                triageSessionId={displayedTriageSessionId}
                effectiveSummary={effectiveSummary}
                localizedInterruptionDetail={localizedInterruptionDetail}
                routingSafetyNotice={routingSafetyNotice}
                resultFormDraft={displayedResultFormDraft}
                readOnly={isHistoryReadOnly}
                onResultFormChange={updateResultFormDraft}
                onNavigate={setLocation}
                copy={t}
              />
            }
          />

          <TriageChatComposer
            input={input}
            inputPlaceholder={inputPlaceholder}
            requestError={requestError}
            isInputDisabled={isInputDisabled}
            isChatPending={isChatPending}
            showReferralNextStepGuidance={showReferralNextStepGuidance}
            messageLimitReached={messageLimitReached}
            primaryReferralEntryHref={primaryReferralEntryHref}
            onInputChange={setInput}
            onInputKeyDown={handleInputKeyDown}
            onSend={handleSend}
            labels={{
              postCompleteTitle: t.triage.post_complete_input_title,
              postCompleteDescription: t.triage.post_complete_input_description,
              disclaimer: t.triage.disclaimer,
              messageLimitReached: t.status.message_limit_reached,
              messageLimitAction: t.status.message_limit_action,
            }}
          />
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
