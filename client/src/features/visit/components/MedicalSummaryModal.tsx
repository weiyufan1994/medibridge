import { useId } from "react";
import { LoaderCircle, RefreshCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type MedicalSummaryModalCopy,
  useMedicalSummaryDraftController,
} from "./useMedicalSummaryDraftController";

type MedicalSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  token: string;
  lang: "en" | "zh";
  copy: MedicalSummaryModalCopy;
  onSigned?: () => void;
};

export function MedicalSummaryModal({
  open,
  onOpenChange,
  visitId,
  token,
  lang,
  copy,
  onSigned,
}: MedicalSummaryModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const {
    disableClose,
    disableRegenerate,
    disableSign,
    errorMessage,
    form,
    handleSign,
    isDraftGenerating,
    isSigning,
    loadDraft,
    setField,
    statusMessage,
  } = useMedicalSummaryDraftController({
    open,
    onOpenChange,
    visitId,
    token,
    lang,
    copy,
    onSigned,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => !disableClose && onOpenChange(nextOpen)}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] p-0 border-0 gap-0"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <DialogTitle
            id={titleId}
            className="text-xl font-semibold text-slate-900"
          >
            {copy.title}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={() => onOpenChange(false)}
            disabled={disableClose}
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
          {isDraftGenerating ? (
            <p
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 text-sm text-slate-600"
            >
              <LoaderCircle
                className="h-4 w-4 animate-spin text-teal-600 motion-reduce:animate-none"
                aria-hidden="true"
              />
              {copy.generatingText}
            </p>
          ) : null}
          {statusMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-slate-600"
            >
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <section className="space-y-2">
            <label
              htmlFor="medical-summary-chief-complaint"
              className="text-sm font-medium text-slate-800"
            >
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
            <label
              htmlFor="medical-summary-hpi"
              className="text-sm font-medium text-slate-800"
            >
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
            <label
              htmlFor="medical-summary-pmh"
              className="text-sm font-medium text-slate-800"
            >
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
            <label
              htmlFor="medical-summary-assessment"
              className="text-sm font-medium text-slate-800"
            >
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
            <label
              htmlFor="medical-summary-plan"
              className="text-sm font-medium text-slate-800"
            >
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
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-4"
            onClick={() => onOpenChange(false)}
            disabled={disableClose}
          >
            {copy.cancelText}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-4 text-slate-700"
            onClick={() => void loadDraft(true)}
            disabled={disableRegenerate}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {copy.regenerateText}
          </Button>
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2 rounded-lg shadow-sm h-11"
            onClick={() => void handleSign()}
            disabled={disableSign}
          >
            {isSigning ? copy.signingText : copy.signText}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
