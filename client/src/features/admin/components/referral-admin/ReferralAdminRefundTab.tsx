import { useAdminActionConfirmation } from "../../adminActionConfirmationContext";
import { getAdminConfirmationCopy } from "../../copy";
import type { useReferralAdminActions } from "../../hooks/useReferralAdminActions";
import type { useReferralAdminSelection } from "../../hooks/useReferralAdminSelection";
import { ReferralRefundSection } from "./ReferralRefundSection";

type SelectionController = ReturnType<typeof useReferralAdminSelection>;
type ActionController = ReturnType<typeof useReferralAdminActions>;
type SelectedOrder = NonNullable<SelectionController["detailQuery"]["data"]>;

export function ReferralAdminRefundTab({
  lang,
  selectedOrder,
  selection,
  actions,
}: {
  lang: "en" | "zh";
  selectedOrder: SelectedOrder;
  selection: SelectionController;
  actions: ActionController;
}) {
  const { requestConfirmation } = useAdminActionConfirmation();
  const orderState = selectedOrder.order;

  return (
    <ReferralRefundSection
      lang={lang}
      paymentStatus={orderState.paymentStatus}
      orderRefundReason={orderState.refundReason}
      refundRequest={selectedOrder.refundRequest}
      refundReasonCode={actions.refundReasonCode}
      refundReasonDetail={actions.refundReasonDetail}
      refundReviewNote={actions.refundReviewNote}
      initiatePending={actions.initiateRefundMutation.isPending}
      reviewPending={actions.reviewRefundMutation.isPending}
      onBack={() => selection.setDetailTab("operations")}
      onRefundReasonCodeChange={actions.setRefundReasonCode}
      onRefundReasonDetailChange={actions.setRefundReasonDetail}
      onRefundReviewNoteChange={actions.setRefundReviewNote}
      onInitiateRefund={() => {
        const confirmation = getAdminConfirmationCopy(
          lang,
          "initiateReferralRefund"
        );
        requestConfirmation({
          title: confirmation.title,
          description: confirmation.description,
          confirmLabel: confirmation.confirmLabel,
          cancelLabel: confirmation.cancelLabel,
          tone: "danger",
          onConfirm: () =>
            actions.initiateRefundMutation.mutateAsync({
              orderId: orderState.id,
              reasonCode: actions.refundReasonCode,
              reasonDetail: actions.refundReasonDetail.trim(),
            }),
        });
      }}
      onReviewRefund={approve => {
        if (!selectedOrder.refundRequest) {
          return;
        }
        const confirmation = getAdminConfirmationCopy(
          lang,
          approve ? "approveReferralRefund" : "rejectReferralRefund"
        );
        requestConfirmation({
          title: confirmation.title,
          description: confirmation.description,
          confirmLabel: confirmation.confirmLabel,
          cancelLabel: confirmation.cancelLabel,
          tone: "danger",
          onConfirm: () =>
            actions.reviewRefundMutation.mutateAsync({
              orderId: orderState.id,
              refundRequestId: selectedOrder.refundRequest!.id,
              approve,
              note: actions.refundReviewNote.trim() || undefined,
            }),
        });
      }}
    />
  );
}
