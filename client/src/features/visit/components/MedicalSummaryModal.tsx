import { type ChangeEvent, useEffect, useId, useState } from "react";
import { RefreshCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type MedicalSummaryModalCopy = {
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
  signFailedText: string;
};

type MedicalSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  token: string;
  lang: "en" | "zh";
  copy: MedicalSummaryModalCopy;
  onSigned?: () => void;
};

type DraftForm = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
};

const EMPTY_FORM: DraftForm = {
  chiefComplaint: "",
  historyOfPresentIllness: "",
  pastMedicalHistory: "",
  assessmentDiagnosis: "",
  planRecommendations: "",
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function MedicalSummaryModal({
  open,
  onOpenChange,
  visitId,
  token,
  lang,
  copy,
  onSigned,
}: MedicalSummaryModalProps) {
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const generateDraftMutation = trpc.appointments.generateMedicalSummaryDraft.useMutation();
  const signMutation = trpc.appointments.signMedicalSummary.useMutation();
  const utils = trpc.useUtils();

  const applyDraft = (draft: DraftForm) => {
    setForm({
      chiefComplaint: draft.chiefComplaint,
      historyOfPresentIllness: draft.historyOfPresentIllness,
      pastMedicalHistory: draft.pastMedicalHistory,
      assessmentDiagnosis: draft.assessmentDiagnosis,
      planRecommendations: draft.planRecommendations,
    });
  };

  const loadDraft = async (forceRegenerate: boolean) => {
    setErrorMessage(null);
    setStatusMessage(copy.generatingText);
    try {
      const draft = await generateDraftMutation.mutateAsync({
        appointmentId: visitId,
        token,
        lang,
        forceRegenerate,
      });
      applyDraft(draft);
      setStatusMessage(null);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(toErrorMessage(error, copy.draftFailedText));
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadDraft(false);
  }, [open]);

  const setField =
    (key: keyof DraftForm) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm(prev => ({
        ...prev,
        [key]: value,
      }));
    };

  const handleSign = async () => {
    setErrorMessage(null);
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
        utils.visit.roomGetMessages.invalidate({
          token,
          limit: 50,
        }),
      ]);
      setStatusMessage(null);
      toast.success(copy.signSuccessText);
      onOpenChange(false);
      onSigned?.();
    } catch (error) {
      setStatusMessage(null);
      const message = toErrorMessage(error, copy.signFailedText);
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const isGenerating = generateDraftMutation.isPending;
  const isSigning = signMutation.isPending;
  const isBusy = isGenerating || isSigning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] p-0 border-0 gap-0"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <DialogTitle id={titleId} className="text-xl font-semibold text-slate-900">
            {copy.title}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </header>

        <DialogDescription id={descriptionId} className="sr-only">
          Medical summary review form before signing and sending to patient.
        </DialogDescription>

        <div className="bg-teal-50 text-teal-800 px-6 py-3 text-sm flex items-center gap-2 border-b border-teal-100">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{copy.aiDisclaimer}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statusMessage ? (
            <p role="status" aria-live="polite" className="text-sm text-slate-600">
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <section className="space-y-2">
            <label htmlFor="medical-summary-chief-complaint" className="text-sm font-medium text-slate-800">
              {copy.chiefComplaintLabel}
            </label>
            <Textarea
              id="medical-summary-chief-complaint"
              rows={3}
              value={form.chiefComplaint}
              onChange={setField("chiefComplaint")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </section>

          <section className="space-y-2">
            <label htmlFor="medical-summary-hpi" className="text-sm font-medium text-slate-800">
              {copy.hpiLabel}
            </label>
            <Textarea
              id="medical-summary-hpi"
              rows={5}
              value={form.historyOfPresentIllness}
              onChange={setField("historyOfPresentIllness")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </section>

          <section className="space-y-2">
            <label htmlFor="medical-summary-pmh" className="text-sm font-medium text-slate-800">
              {copy.pmhLabel}
            </label>
            <Textarea
              id="medical-summary-pmh"
              rows={4}
              value={form.pastMedicalHistory}
              onChange={setField("pastMedicalHistory")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </section>

          <section className="space-y-2">
            <label htmlFor="medical-summary-assessment" className="text-sm font-medium text-slate-800">
              {copy.assessmentLabel}
            </label>
            <Textarea
              id="medical-summary-assessment"
              rows={4}
              value={form.assessmentDiagnosis}
              onChange={setField("assessmentDiagnosis")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </section>

          <section className="space-y-2">
            <label htmlFor="medical-summary-plan" className="text-sm font-medium text-slate-800">
              {copy.planLabel}
            </label>
            <Textarea
              id="medical-summary-plan"
              rows={5}
              value={form.planRecommendations}
              onChange={setField("planRecommendations")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </section>
        </div>

        <footer className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <Button type="button" variant="ghost" className="h-11 px-4" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {copy.cancelText}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-4 text-slate-700"
            onClick={() => void loadDraft(true)}
            disabled={isBusy}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {copy.regenerateText}
          </Button>
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2 rounded-lg shadow-sm h-11"
            onClick={() => void handleSign()}
            disabled={isBusy}
          >
            {isSigning ? copy.signingText : copy.signText}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
