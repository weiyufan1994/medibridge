import { Button } from "@/components/ui/button";
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
  onEndConsultation: () => void;
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
  onEndConsultation,
}: EndConsultationDialogProps) {
  if (!canEndConsultation) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isEnding}
        >
          {endConsultationText}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{endConsultationTitle}</AlertDialogTitle>
          <AlertDialogDescription>{endConsultationDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={onEndConsultation}>
            {isEnding ? endingText : confirmEndText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
