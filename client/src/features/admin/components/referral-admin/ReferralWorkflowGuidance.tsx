import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReferralCopy, getReferralStatusLabel } from "@/features/referrals";
import { getReferralStatusAdvanceMode } from "../../adminStatusTransitions";
import {
  getReferralAdminStatusTone,
  type ReferralAdminTaskKind,
} from "../../referralAdminPresentation";
import { getAdminStatusGuidanceCopy } from "../../copy";
import { AdminStatusBadge } from "../AdminStatusBadge";
import type { ReferralOrderStatus } from "@shared/referrals";

type ReferralWorkflowGuidanceProps = {
  lang: "en" | "zh";
  status: ReferralOrderStatus;
  taskKind: ReferralAdminTaskKind;
  primaryNextStatus: ReferralOrderStatus | null;
  paymentStatus: string;
  onOpenRefund: () => void;
};

export function ReferralWorkflowGuidance({
  lang,
  status,
  taskKind,
  primaryNextStatus,
  paymentStatus,
  onOpenRefund,
}: ReferralWorkflowGuidanceProps) {
  const copy = getReferralCopy(lang);
  const statusGuidanceCopy = getAdminStatusGuidanceCopy(lang);
  const advanceMode = getReferralStatusAdvanceMode(status);

  return (
    <section className="mb-4 rounded-xl border border-admin-border-strong bg-admin-accent px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-accent-foreground">
        {statusGuidanceCopy.referral.title}
      </p>
      <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
        {statusGuidanceCopy.referral.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-admin-muted-foreground">
            {statusGuidanceCopy.referral.currentStatus}
          </p>
          <AdminStatusBadge
            label={getReferralStatusLabel(status, lang)}
            tone={getReferralAdminStatusTone(status)}
          />
        </div>
        <ArrowRight
          aria-hidden="true"
          className="mt-4 size-4 text-admin-accent-foreground"
        />
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-admin-muted-foreground">
            {statusGuidanceCopy.referral.nextStatus}
          </p>
          {primaryNextStatus ? (
            <AdminStatusBadge
              label={getReferralStatusLabel(primaryNextStatus, lang)}
              tone={getReferralAdminStatusTone(primaryNextStatus)}
            />
          ) : (
            <span className="inline-flex min-h-6 items-center rounded-md border border-admin-border bg-admin-surface px-2 text-xs font-medium text-admin-foreground">
              {advanceMode === "terminal"
                ? statusGuidanceCopy.referral.noNextStatus
                : statusGuidanceCopy.referral.noFixedTarget}
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-admin-foreground">
        {copy.admin.nextStep}: {copy.admin.taskDescriptions[taskKind]}
      </p>
      <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
        {statusGuidanceCopy.referral.advanceModes[advanceMode]}
      </p>
      {taskKind === "refund_review" ? (
        <Button size="sm" className="mt-3" onClick={onOpenRefund}>
          {copy.admin.refundTitle}
        </Button>
      ) : null}
      {paymentStatus === "paid" &&
      taskKind !== "refund_review" &&
      taskKind !== "refund_processing" &&
      taskKind !== "terminal" ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={onOpenRefund}
        >
          {copy.admin.moreActions}
        </Button>
      ) : null}
    </section>
  );
}
