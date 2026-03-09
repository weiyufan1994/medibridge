import { Clock3 } from "lucide-react";
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
  const footerClassName = canExtend
    ? "mt-6 flex-row justify-end gap-3"
    : "mt-6";
  const endVisitClassName = canExtend
    ? "h-11 rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500"
    : "h-11 w-full rounded-lg bg-teal-600 px-4 py-2 font-medium text-white transition-colors hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:max-w-md">
        <AlertDialogHeader className="gap-3 text-left">
          <div className="mb-4 w-fit rounded-full bg-amber-50 p-3 text-amber-600">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-slate-600">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={footerClassName}>
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
