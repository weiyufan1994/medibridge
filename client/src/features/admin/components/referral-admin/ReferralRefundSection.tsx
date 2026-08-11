import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getReferralCopy, getRefundStatusLabel } from "@/features/referrals";
import {
  REFERRAL_REFUND_REASON_CODE_VALUES,
  type RefundRequestStatus,
  type ReferralRefundReasonCode,
} from "@shared/referrals";
import { SectionBox } from "./ReferralAdminPrimitives";

type RefundRequest = {
  status: RefundRequestStatus;
  reasonDetail: string | null;
};

type ReferralRefundSectionProps = {
  lang: "en" | "zh";
  paymentStatus: string;
  orderRefundReason: string | null;
  refundRequest: RefundRequest | null;
  refundReasonCode: ReferralRefundReasonCode;
  refundReasonDetail: string;
  refundReviewNote: string;
  initiatePending: boolean;
  reviewPending: boolean;
  onBack: () => void;
  onRefundReasonCodeChange: (value: ReferralRefundReasonCode) => void;
  onRefundReasonDetailChange: (value: string) => void;
  onRefundReviewNoteChange: (value: string) => void;
  onInitiateRefund: () => void;
  onReviewRefund: (approve: boolean) => void;
};

export function ReferralRefundSection({
  lang,
  paymentStatus,
  orderRefundReason,
  refundRequest,
  refundReasonCode,
  refundReasonDetail,
  refundReviewNote,
  initiatePending,
  reviewPending,
  onBack,
  onRefundReasonCodeChange,
  onRefundReasonDetailChange,
  onRefundReviewNoteChange,
  onInitiateRefund,
  onReviewRefund,
}: ReferralRefundSectionProps) {
  const copy = getReferralCopy(lang);

  return (
    <TabsContent value="refund" className="min-h-0 overflow-y-auto p-4">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mb-3"
        onClick={onBack}
      >
        {copy.admin.detailTabs.operations}
      </Button>
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionBox title={copy.admin.initiateRefund}>
          <div className="space-y-2">
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={refundReasonCode}
              onChange={event =>
                onRefundReasonCodeChange(
                  event.target.value as ReferralRefundReasonCode
                )
              }
            >
              {REFERRAL_REFUND_REASON_CODE_VALUES.map(reasonCode => (
                <option key={reasonCode} value={reasonCode}>
                  {copy.admin.refundReasonCodes[reasonCode]}
                </option>
              ))}
            </select>
            <Textarea
              value={refundReasonDetail}
              onChange={event => onRefundReasonDetailChange(event.target.value)}
              placeholder={copy.admin.refundReasonDetail}
              className="min-h-28 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                initiatePending ||
                refundReasonDetail.trim().length < 1 ||
                paymentStatus !== "paid"
              }
              onClick={onInitiateRefund}
            >
              {copy.admin.initiateRefund}
            </Button>
          </div>
        </SectionBox>

        <SectionBox title={copy.admin.refundTitle}>
          <div className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm text-muted-foreground">
            <p>
              {copy.orderDetail.refundStatus}:{" "}
              {refundRequest
                ? getRefundStatusLabel(refundRequest.status, lang)
                : copy.common.notAvailable}
            </p>
            <p className="mt-2">
              {copy.admin.reason}:{" "}
              {refundRequest?.reasonDetail ||
                orderRefundReason ||
                copy.common.notAvailable}
            </p>
          </div>
          <Textarea
            value={refundReviewNote}
            onChange={event => onRefundReviewNoteChange(event.target.value)}
            placeholder={copy.admin.refundReviewNote}
            className="mt-3 min-h-28 px-2 py-1 text-sm leading-tight"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={reviewPending || !refundRequest}
              onClick={() => onReviewRefund(true)}
            >
              {copy.admin.approveRefund}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={reviewPending || !refundRequest}
              onClick={() => onReviewRefund(false)}
            >
              {copy.admin.rejectRefund}
            </Button>
          </div>
        </SectionBox>
      </div>
    </TabsContent>
  );
}
