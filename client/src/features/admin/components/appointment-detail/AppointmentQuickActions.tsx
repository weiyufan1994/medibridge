import { Button } from "@/components/ui/button";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import {
  getAdminConfirmationCopy,
  type AdminLang,
} from "@/features/admin/copy";
import type {
  IssueLinksMutation,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
} from "@/features/admin/types";

type AppointmentQuickActionsProps = {
  tr: (zh: string, en: string) => string;
  lang: AdminLang;
  appointmentId: number;
  hideQuickActions: boolean;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  canReinitiatePayment: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  handleCopyDebugSnapshot: () => Promise<void>;
};

export function AppointmentQuickActions({
  tr,
  lang,
  appointmentId,
  hideQuickActions,
  beforeReinitiatePayment,
  beforeResendAccessLink,
  beforeIssueLinks,
  resendPaymentMutation,
  resendAccessLinkMutation,
  issueLinksMutation,
  canReinitiatePayment,
  canResendAccessLink,
  canIssueAccessLinks,
  handleCopyDebugSnapshot,
}: AppointmentQuickActionsProps) {
  const { requestConfirmation } = useAdminActionConfirmation();

  return (
    <div className="flex flex-wrap gap-2">
      {!hideQuickActions ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!beforeReinitiatePayment()) return;
            const confirmation = getAdminConfirmationCopy(
              lang,
              "reinitiatePayment"
            );
            requestConfirmation({
              title: confirmation.title,
              description: confirmation.description,
              confirmLabel: confirmation.continueLabel,
              cancelLabel: confirmation.cancelLabel,
              tone: "danger",
              onConfirm: () =>
                resendPaymentMutation.mutateAsync({ appointmentId }),
            });
          }}
          disabled={!canReinitiatePayment || resendPaymentMutation.isPending}
          title={
            !canReinitiatePayment
              ? tr(
                  "仅管理员可重新发起支付。",
                  "Only admin can re-initiate payment."
                )
              : undefined
          }
        >
          {resendPaymentMutation.isPending
            ? tr("正在打开支付页...", "Opening checkout...")
            : tr("重新发起支付", "Re-initiate Payment")}
        </Button>
      ) : null}
      {!hideQuickActions ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!beforeResendAccessLink()) return;
            const confirmation = getAdminConfirmationCopy(
              lang,
              "resendAccessLink"
            );
            requestConfirmation({
              title: confirmation.title,
              description: confirmation.description,
              confirmLabel: confirmation.continueLabel,
              cancelLabel: confirmation.cancelLabel,
              onConfirm: () =>
                resendAccessLinkMutation.mutateAsync({ appointmentId }),
            });
          }}
          disabled={!canResendAccessLink || resendAccessLinkMutation.isPending}
          title={
            !canResendAccessLink
              ? tr(
                  "仅管理员与 ops 可重发访问链接。",
                  "Only admin/ops can resend access links."
                )
              : undefined
          }
        >
          {resendAccessLinkMutation.isPending
            ? tr("发送中...", "Sending...")
            : tr("重发访问链接邮件", "Resend Access Link Email")}
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={() => {
          if (!beforeIssueLinks()) return;
          const confirmation = getAdminConfirmationCopy(
            lang,
            "issueAccessLinks"
          );
          requestConfirmation({
            title: confirmation.title,
            description: confirmation.description,
            confirmLabel: confirmation.continueLabel,
            cancelLabel: confirmation.cancelLabel,
            tone: "danger",
            onConfirm: () => issueLinksMutation.mutateAsync({ appointmentId }),
          });
        }}
        disabled={!canIssueAccessLinks || issueLinksMutation.isPending}
        title={
          !canIssueAccessLinks
            ? tr(
                "仅管理员与 ops 可签发新访问链接。",
                "Only admin/ops can issue new access links."
              )
            : undefined
        }
      >
        {issueLinksMutation.isPending
          ? tr("签发中...", "Issuing...")
          : tr("签发新访问链接", "Issue New Access Links")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => void handleCopyDebugSnapshot()}
      >
        {tr("复制调试快照", "Copy Debug Snapshot")}
      </Button>
    </div>
  );
}
