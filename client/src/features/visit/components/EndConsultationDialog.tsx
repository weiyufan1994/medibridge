import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
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
      <AlertDialogContent className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:max-w-md">
        <AlertDialogHeader className="gap-3 text-left">
          <div className="mb-4 w-fit rounded-full bg-teal-50 p-3 text-teal-600">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="text-left">{endConsultationTitle}</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-slate-600">
            {endConsultationDesc}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex-row justify-end gap-3">
          <AlertDialogCancel className="h-11 rounded-lg px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700"
            onClick={onGenerateSummary}
          >
            {isEnding ? endingText : confirmEndText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
