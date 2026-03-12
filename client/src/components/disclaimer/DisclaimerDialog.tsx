import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DISCLAIMER_DIALOG_BODY_CLASS,
  DISCLAIMER_DIALOG_CONTENT_CLASS,
  DISCLAIMER_DIALOG_DESCRIPTION_CLASS,
  DISCLAIMER_DIALOG_FOOTER_CLASS,
  DISCLAIMER_DIALOG_HEADER_CLASS,
  DISCLAIMER_DIALOG_ICON_AMBER,
  DISCLAIMER_DIALOG_ICON_CLASS,
  DISCLAIMER_DIALOG_ICON_TEAL,
  DISCLAIMER_DIALOG_TEXT_CLASS,
  DISCLAIMER_WARNING_BANNER_CLASS,
  DISCLAIMER_DIALOG_TITLE_CLASS,
  DISCLAIMER_INLINE_NOTICE_CLASS,
  DISCLAIMER_INLINE_NOTICE_ICON_CLASS,
  DISCLAIMER_WARNING_NOTICE_CLASS,
} from "@/components/disclaimer/disclaimerStyles";

type DisclaimerDialogActionLabel = {
  confirmText: string;
  onConfirm: () => void;
  cancelText: string;
  onCancel?: () => void;
};

type DisclaimerDialogBaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelText: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel?: () => void;
  icon?: "info" | "alert";
  children?: ReactNode;
  showHeaderIcon?: boolean;
  titleAlign?: "left" | "center";
};

export function DisclaimerDialog(props: DisclaimerDialogBaseProps & DisclaimerDialogActionLabel) {
  const {
    open,
    onOpenChange,
    title,
    description,
    cancelText,
    confirmText,
    onConfirm,
    onCancel,
    icon = "alert",
    children,
    titleAlign = "left",
  } = props;

  const titleAlignClass = titleAlign === "center" ? "sm:text-left" : "text-left";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DISCLAIMER_DIALOG_CONTENT_CLASS}>
        <div className={DISCLAIMER_DIALOG_HEADER_CLASS}>
          <div
            className={`${DISCLAIMER_DIALOG_ICON_CLASS} ${icon === "info" ? DISCLAIMER_DIALOG_ICON_TEAL : DISCLAIMER_DIALOG_ICON_AMBER}`}
          >
            {icon === "info" ? <Info className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
        </div>
        <div className={DISCLAIMER_DIALOG_BODY_CLASS}>
          <DialogHeader className={`gap-2 ${titleAlignClass}`}>
            <DialogTitle className={DISCLAIMER_DIALOG_TITLE_CLASS}>{title}</DialogTitle>
            <DialogDescription className={DISCLAIMER_DIALOG_DESCRIPTION_CLASS}>
              {description}
            </DialogDescription>
          </DialogHeader>
          {children ? <div className={DISCLAIMER_DIALOG_TEXT_CLASS}>{children}</div> : null}
        </div>
        <DialogFooter className={DISCLAIMER_DIALOG_FOOTER_CLASS}>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
          >
            {cancelText}
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DisclaimerNoticeProps = {
  text: string;
  className?: string;
};

export function DisclaimerNotice({ text, className }: DisclaimerNoticeProps) {
  return (
    <div className={`${DISCLAIMER_INLINE_NOTICE_CLASS} ${className ?? ""}`}>
      <div className="mb-1 flex items-start gap-2">
        <Info className={DISCLAIMER_INLINE_NOTICE_ICON_CLASS} />
        <p>{text}</p>
      </div>
    </div>
  );
}

type DisclaimerWarningNoticeProps = {
  text: string;
  className?: string;
  role?: "status" | "alert";
  ariaLive?: "polite" | "assertive";
};

export function DisclaimerWarningNotice({
  text,
  className,
  role = "status",
  ariaLive = "polite",
}: DisclaimerWarningNoticeProps) {
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`${className ?? ""} ${DISCLAIMER_WARNING_NOTICE_CLASS}`}
    >
      {text}
    </div>
  );
}

type DisclaimerWarningBannerProps = {
  text: string;
  className?: string;
  role?: "status" | "alert";
  ariaLive?: "polite" | "assertive";
};

export function DisclaimerWarningBanner({
  text,
  className,
  role = "status",
  ariaLive = "polite",
}: DisclaimerWarningBannerProps) {
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`${className ?? ""} ${DISCLAIMER_WARNING_BANNER_CLASS}`}
    >
      {text}
    </div>
  );
}
