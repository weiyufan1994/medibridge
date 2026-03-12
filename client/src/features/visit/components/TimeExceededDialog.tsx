import { Clock3 } from "lucide-react";
import {
  WARNING_ALERT_DIALOG_CONTENT_CLASS,
  WARNING_ALERT_DIALOG_DESCRIPTION_CLASS,
  WARNING_ALERT_DIALOG_FOOTER_CLASS,
  WARNING_ALERT_DIALOG_ICON_AMBER,
  WARNING_ALERT_DIALOG_ICON_CLASS,
  WARNING_ALERT_DIALOG_TITLE_CLASS,
} from "@/components/disclaimer/disclaimerStyles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TimeExceededDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  canExtend: boolean;
  isExtending: boolean;
  extendText: string;
  extendingText: string;
  endVisitText: string;
  onExtend: () => void;
  onEndVisit: () => void;
};

export function TimeExceededDialog({
  open,
  onOpenChange,
  title,
  description,
  canExtend,
  isExtending,
  extendText,
  extendingText,
  endVisitText,
  onExtend,
  onEndVisit,
}: TimeExceededDialogProps) {
  const endVisitClassName = canExtend
    ? "h-11 rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
    : "h-11 w-full rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={WARNING_ALERT_DIALOG_CONTENT_CLASS}>
        <AlertDialogHeader className="gap-3 text-left">
          <div className={`${WARNING_ALERT_DIALOG_ICON_CLASS} ${WARNING_ALERT_DIALOG_ICON_AMBER}`}>
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle className={WARNING_ALERT_DIALOG_TITLE_CLASS}>{title}</AlertDialogTitle>
          <AlertDialogDescription className={WARNING_ALERT_DIALOG_DESCRIPTION_CLASS}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={canExtend ? WARNING_ALERT_DIALOG_FOOTER_CLASS : "mt-6"}>
          {canExtend ? (
            <AlertDialogAction
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500"
              disabled={isExtending}
              onClick={event => {
                event.preventDefault();
                onExtend();
                onOpenChange(false);
              }}
            >
              {isExtending ? extendingText : extendText}
            </AlertDialogAction>
          ) : null}
          <AlertDialogAction
            className={endVisitClassName}
            onClick={() => {
              onEndVisit();
              onOpenChange(false);
            }}
          >
            {endVisitText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
