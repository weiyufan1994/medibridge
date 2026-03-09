export type MedicalSummaryDraftForm = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
};

export const DRAFT_GENERATION_TIMEOUT_SECONDS = 120;

export const EMPTY_DRAFT_FORM: MedicalSummaryDraftForm = {
  chiefComplaint: "",
  historyOfPresentIllness: "",
  pastMedicalHistory: "",
  assessmentDiagnosis: "",
  planRecommendations: "",
};

export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function resolveGeneratingMessage(input: {
  fallbackText: string;
  countdownTemplate: string;
  remainingSeconds: number | null;
}) {
  if (input.remainingSeconds === null) {
    return input.fallbackText;
  }
  return input.countdownTemplate.replace("{{time}}", formatCountdown(input.remainingSeconds));
}

export function isDraftFormComplete(form: MedicalSummaryDraftForm) {
  return (
    form.chiefComplaint.trim().length > 0 &&
    form.historyOfPresentIllness.trim().length > 0 &&
    form.pastMedicalHistory.trim().length > 0 &&
    form.assessmentDiagnosis.trim().length > 0 &&
    form.planRecommendations.trim().length > 0
  );
}

export function shouldAutoLoadInitialDraft(input: {
  open: boolean;
  hasLoadedInitialDraft: boolean;
}) {
  return input.open && !input.hasLoadedInitialDraft;
}

export function shouldApplyDraftResponse(input: {
  requestId: number;
  activeRequestId: number;
  draftTimedOut: boolean;
}) {
  if (input.requestId !== input.activeRequestId) {
    return false;
  }
  if (input.draftTimedOut) {
    return false;
  }
  return true;
}
