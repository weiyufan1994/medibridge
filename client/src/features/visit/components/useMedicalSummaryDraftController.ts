import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  DRAFT_GENERATION_TIMEOUT_SECONDS,
  EMPTY_DRAFT_FORM,
  type MedicalSummaryDraftForm,
  isDraftFormComplete,
  shouldApplyDraftResponse,
  shouldAutoLoadInitialDraft,
} from "./medicalSummaryModal.helpers";

export type MedicalSummaryModalCopy = {
  title: string;
  aiDisclaimer: string;
  chiefComplaintLabel: string;
  hpiLabel: string;
  pmhLabel: string;
  assessmentLabel: string;
  planLabel: string;
  cancelText: string;
  regenerateText: string;
  signText: string;
  generatingText: string;
  signingText: string;
  signSuccessText: string;
  draftFailedText: string;
  draftTimeoutText: string;
  draftTimeoutHintText: string;
  requiredFieldsText: string;
  signFailedText: string;
};

type MedicalSummaryDraftControllerOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  token: string;
  lang: "en" | "zh";
  copy: MedicalSummaryModalCopy;
  onSigned?: () => void;
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

const DRAFT_POLL_INTERVAL_MS = 2000;

export function useMedicalSummaryDraftController({
  open,
  onOpenChange,
  visitId,
  token,
  lang,
  copy,
  onSigned,
}: MedicalSummaryDraftControllerOptions) {
  const [form, setForm] = useState<MedicalSummaryDraftForm>(EMPTY_DRAFT_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDraftGenerating, setIsDraftGenerating] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [draftTimedOut, setDraftTimedOut] = useState(false);
  const [, setActiveDraftRequestId] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [hasLoadedInitialDraft, setHasLoadedInitialDraft] = useState(false);

  const activeDraftRequestIdRef = useRef(0);
  const draftTimedOutRef = useRef(false);
  const isDirtyRef = useRef(false);
  const draftPollTimerRef = useRef<number | null>(null);
  const draftPollResolveRef = useRef<(() => void) | null>(null);

  const generateDraftMutation =
    trpc.appointments.generateMedicalSummaryDraft.useMutation();
  const signMutation = trpc.appointments.signMedicalSummary.useMutation();
  const utils = trpc.useUtils();

  const clearDraftPollTimer = useCallback(() => {
    if (draftPollTimerRef.current !== null) {
      window.clearTimeout(draftPollTimerRef.current);
      draftPollTimerRef.current = null;
    }
    if (draftPollResolveRef.current) {
      const resolve = draftPollResolveRef.current;
      draftPollResolveRef.current = null;
      resolve();
    }
  }, []);

  const waitForNextDraftPoll = useCallback(
    () =>
      new Promise<void>(resolve => {
        clearDraftPollTimer();
        draftPollResolveRef.current = () => {
          draftPollResolveRef.current = null;
          resolve();
        };
        draftPollTimerRef.current = window.setTimeout(() => {
          draftPollTimerRef.current = null;
          const done = draftPollResolveRef.current;
          draftPollResolveRef.current = null;
          done?.();
        }, DRAFT_POLL_INTERVAL_MS);
      }),
    [clearDraftPollTimer]
  );

  const resetDraftState = useCallback(() => {
    clearDraftPollTimer();
    setForm(EMPTY_DRAFT_FORM);
    setErrorMessage(null);
    setStatusMessage(null);
    setIsDraftGenerating(false);
    setRemainingSeconds(null);
    setDraftTimedOut(false);
    setActiveDraftRequestId(0);
    activeDraftRequestIdRef.current = 0;
    draftTimedOutRef.current = false;
    setIsDirty(false);
    isDirtyRef.current = false;
    setHasLoadedInitialDraft(false);
  }, [clearDraftPollTimer]);

  const applyDraft = useCallback((draft: MedicalSummaryDraftForm) => {
    setForm({
      chiefComplaint: draft.chiefComplaint,
      historyOfPresentIllness: draft.historyOfPresentIllness,
      pastMedicalHistory: draft.pastMedicalHistory,
      assessmentDiagnosis: draft.assessmentDiagnosis,
      planRecommendations: draft.planRecommendations,
    });
    setIsDirty(false);
    isDirtyRef.current = false;
  }, []);

  const loadDraft = useCallback(
    async (forceRegenerate: boolean) => {
      const requestId = activeDraftRequestIdRef.current + 1;
      activeDraftRequestIdRef.current = requestId;
      setActiveDraftRequestId(requestId);
      setHasLoadedInitialDraft(true);
      setErrorMessage(null);
      setStatusMessage(null);
      setDraftTimedOut(false);
      draftTimedOutRef.current = false;
      setRemainingSeconds(DRAFT_GENERATION_TIMEOUT_SECONDS);
      setIsDraftGenerating(true);

      try {
        while (true) {
          const draft = await generateDraftMutation.mutateAsync({
            appointmentId: visitId,
            token,
            lang,
            forceRegenerate,
          });
          if (
            !shouldApplyDraftResponse({
              requestId,
              activeRequestId: activeDraftRequestIdRef.current,
              draftTimedOut: draftTimedOutRef.current,
            })
          ) {
            return;
          }
          if (draft.source === "pending" && !forceRegenerate) {
            await waitForNextDraftPoll();
            if (
              !shouldApplyDraftResponse({
                requestId,
                activeRequestId: activeDraftRequestIdRef.current,
                draftTimedOut: draftTimedOutRef.current,
              })
            ) {
              return;
            }
            continue;
          }
          if (isDirtyRef.current && !forceRegenerate) {
            setIsDraftGenerating(false);
            setRemainingSeconds(null);
            clearDraftPollTimer();
            return;
          }
          applyDraft(draft);
          setIsDraftGenerating(false);
          setRemainingSeconds(null);
          clearDraftPollTimer();
          return;
        }
      } catch (error) {
        if (requestId !== activeDraftRequestIdRef.current) {
          return;
        }
        setIsDraftGenerating(false);
        setRemainingSeconds(null);
        clearDraftPollTimer();
        setErrorMessage(toErrorMessage(error, copy.draftFailedText));
      }
    },
    [
      applyDraft,
      clearDraftPollTimer,
      copy.draftFailedText,
      generateDraftMutation,
      lang,
      token,
      visitId,
      waitForNextDraftPoll,
    ]
  );

  useEffect(() => {
    if (!isDraftGenerating) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds(previous => {
        if (previous === null) {
          return previous;
        }
        return Math.max(previous - 1, 0);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isDraftGenerating]);

  useEffect(() => {
    if (
      !isDraftGenerating ||
      remainingSeconds === null ||
      remainingSeconds > 0
    ) {
      return;
    }
    setIsDraftGenerating(false);
    setDraftTimedOut(true);
    draftTimedOutRef.current = true;
    setErrorMessage(copy.draftTimeoutText);
    setStatusMessage(copy.draftTimeoutHintText);
    setRemainingSeconds(null);
    clearDraftPollTimer();
  }, [
    clearDraftPollTimer,
    copy.draftTimeoutHintText,
    copy.draftTimeoutText,
    isDraftGenerating,
    remainingSeconds,
  ]);

  useEffect(() => {
    if (!shouldAutoLoadInitialDraft({ open, hasLoadedInitialDraft })) {
      return;
    }
    void loadDraft(false);
  }, [hasLoadedInitialDraft, loadDraft, open]);

  useEffect(() => {
    resetDraftState();
  }, [lang, resetDraftState, token, visitId]);

  useEffect(() => () => clearDraftPollTimer(), [clearDraftPollTimer]);

  const setField =
    (key: keyof MedicalSummaryDraftForm) =>
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm(previous => ({ ...previous, [key]: value }));
      setIsDirty(true);
      isDirtyRef.current = true;
      setStatusMessage(null);
    };

  const handleSign = async () => {
    setErrorMessage(null);
    if (!isDraftFormComplete(form)) {
      setErrorMessage(copy.requiredFieldsText);
      return;
    }
    setStatusMessage(copy.signingText);
    try {
      await signMutation.mutateAsync({
        appointmentId: visitId,
        token,
        chiefComplaint: form.chiefComplaint,
        historyOfPresentIllness: form.historyOfPresentIllness,
        pastMedicalHistory: form.pastMedicalHistory,
        assessmentDiagnosis: form.assessmentDiagnosis,
        planRecommendations: form.planRecommendations,
      });
      await Promise.all([
        utils.appointments.getByToken.invalidate({
          appointmentId: visitId,
          token,
          lang,
        }),
        utils.appointments.listMyAppointments.invalidate(),
        utils.appointments.listMine.invalidate(),
        utils.visit.roomGetMessages.invalidate({ token, limit: 50 }),
      ]);
      setStatusMessage(null);
      toast.success(copy.signSuccessText);
      resetDraftState();
      onOpenChange(false);
      onSigned?.();
    } catch (error) {
      setStatusMessage(null);
      const message = toErrorMessage(error, copy.signFailedText);
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const isSigning = signMutation.isPending;
  return {
    disableClose: isSigning,
    disableRegenerate: isSigning || isDraftGenerating,
    disableSign: isSigning || (isDraftGenerating && !draftTimedOut),
    errorMessage,
    form,
    handleSign,
    isDraftGenerating,
    isSigning,
    loadDraft,
    remainingSeconds,
    resetDraftState,
    setField,
    statusMessage,
  };
}
