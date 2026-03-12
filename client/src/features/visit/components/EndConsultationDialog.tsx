import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import {
  WARNING_ALERT_DIALOG_CONTENT_CLASS,
  WARNING_ALERT_DIALOG_DESCRIPTION_CLASS,
  WARNING_ALERT_DIALOG_FOOTER_CLASS,
  WARNING_ALERT_DIALOG_ICON_CLASS,
  WARNING_ALERT_DIALOG_ICON_TEAL,
  WARNING_ALERT_DIALOG_TITLE_CLASS,
} from "@/components/disclaimer/disclaimerStyles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type EndConsultationDialogProps = {
  canEndConsultation: boolean;
  endConsultationText: string;
  endConsultationTitle: string;
  endConsultationDesc: string;
  cancelText: string;
  confirmEndText: string;
  endingText: string;
  isEnding: boolean;
  onGenerateSummary: () => void;
};

export function EndConsultationDialog({
  canEndConsultation,
  endConsultationText,
  endConsultationTitle,
  endConsultationDesc,
  cancelText,
  confirmEndText,
  endingText,
  isEnding,
  onGenerateSummary,
}: EndConsultationDialogProps) {
  if (!canEndConsultation) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-4 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-full hover:bg-rose-100 transition-colors border border-rose-100"
          disabled={isEnding}
        >
          {endConsultationText}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={WARNING_ALERT_DIALOG_CONTENT_CLASS}>
        <AlertDialogHeader className="gap-3 text-left">
          <div className={`${WARNING_ALERT_DIALOG_ICON_CLASS} ${WARNING_ALERT_DIALOG_ICON_TEAL}`}>
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle className={WARNING_ALERT_DIALOG_TITLE_CLASS}>{endConsultationTitle}</AlertDialogTitle>
          <AlertDialogDescription className={WARNING_ALERT_DIALOG_DESCRIPTION_CLASS}>
            {endConsultationDesc}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={WARNING_ALERT_DIALOG_FOOTER_CLASS}>
          <AlertDialogCancel className="h-11 rounded-lg px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700"
            onClick={onGenerateSummary}
            disabled={isEnding}
          >
            {isEnding ? endingText : confirmEndText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
