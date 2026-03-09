import { useId } from "react";
import { X } from "lucide-react";
import { formatAppointmentTimes } from "@/lib/appointmentTime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type PatientSummaryModalCopy = {
  title: string;
  subtitle: string;
  closeText: string;
  doctorLabel: string;
  timeLabel: string;
  issuedAtLabel: string;
  localTimeLabel: string;
  chinaTimeLabel: string;
  chiefComplaintLabel: string;
  hpiLabel: string;
  pmhLabel: string;
  assessmentLabel: string;
  planLabel: string;
  disclaimer: string;
  loadingText: string;
  emptyText: string;
  fallbackDoctor: string;
};

type MedicalSummaryData = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  updatedAt: Date | string;
};

type PatientSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: PatientSummaryModalCopy;
  resolved: "en" | "zh";
  doctorName: string | null;
  scheduledAt: Date | string | null;
  summary: MedicalSummaryData | null;
  isLoading: boolean;
  errorMessage: string | null;
};

function toDateText(value: Date | string, locale: string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString(locale);
}

export function PatientSummaryModal({
  open,
  onOpenChange,
  copy,
  resolved,
  doctorName,
  scheduledAt,
  summary,
  isLoading,
  errorMessage,
}: PatientSummaryModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const locale = resolved === "zh" ? "zh-CN" : "en-US";
  const timeDisplay = formatAppointmentTimes(scheduledAt, "-", locale);
  const displayDoctor = doctorName?.trim().length ? doctorName : copy.fallbackDoctor;

  const sections = summary
    ? [
        { label: copy.chiefComplaintLabel, value: summary.chiefComplaint },
        { label: copy.hpiLabel, value: summary.historyOfPresentIllness },
        { label: copy.pmhLabel, value: summary.pastMedicalHistory },
        { label: copy.assessmentLabel, value: summary.assessmentDiagnosis },
        { label: copy.planLabel, value: summary.planRecommendations },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[90vh] max-w-5xl gap-0 overflow-hidden rounded-3xl border-0 bg-slate-100 p-0 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-7">
          <div className="space-y-1">
            <DialogTitle id={titleId} className="text-lg font-semibold text-slate-900">
              {copy.title}
            </DialogTitle>
            <p className="text-sm text-slate-500">{copy.subtitle}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-teal-600"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{copy.closeText}</span>
          </Button>
        </header>

        <DialogDescription id={descriptionId} className="sr-only">
          {copy.subtitle}
        </DialogDescription>

        <div className="overflow-y-auto px-4 py-5 md:px-8 md:py-7">
          <article
            role="document"
            className="mx-auto w-full max-w-[794px] rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] md:p-9"
          >
            {isLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-slate-600">
                {copy.loadingText}
              </p>
            ) : null}

            {errorMessage ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {errorMessage}
              </p>
            ) : null}

            {!isLoading && !errorMessage ? (
              <>
                <section className="grid gap-3 border-b border-slate-200 pb-5 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {copy.doctorLabel}
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{displayDoctor}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {copy.timeLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {copy.localTimeLabel}: {timeDisplay.localTime}
                    </p>
                    <p className="text-sm text-slate-700">
                      {copy.chinaTimeLabel}: {timeDisplay.doctorTime}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {copy.issuedAtLabel}: {summary ? toDateText(summary.updatedAt, locale) : "-"}
                    </p>
                  </div>
                </section>

                {summary ? (
                  <section className="mt-6 space-y-5">
                    {sections.map(section => (
                      <div key={section.label}>
                        <h3 className="text-sm font-semibold text-teal-700">{section.label}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                          {section.value || "-"}
                        </p>
                      </div>
                    ))}
                  </section>
                ) : (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  >
                    {copy.emptyText}
                  </p>
                )}

                <footer className="mt-8 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">{copy.disclaimer}</p>
                </footer>
              </>
            ) : null}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
