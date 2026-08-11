import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getReferralCopy, getReferralStatusLabel } from "@/features/referrals";
import { cn } from "@/lib/utils";
import type { ReferralOrderStatus } from "@shared/referrals";
import { getAdminStatusGuidanceCopy } from "../../copy";
import { FieldShell, SectionBox } from "./ReferralAdminPrimitives";

type ReferralStatusSectionProps = {
  lang: "en" | "zh";
  manualStatusTargets: ReferralOrderStatus[];
  isScheduledCompletion: boolean;
  selectedStatus: ReferralOrderStatus;
  statusReason: string;
  statusDraftIsDirty: boolean;
  updatePending: boolean;
  onSelectedStatusChange: (value: ReferralOrderStatus) => void;
  onStatusReasonChange: (value: string) => void;
  onSubmit: () => void;
};

export function ReferralStatusSection({
  lang,
  manualStatusTargets,
  isScheduledCompletion,
  selectedStatus,
  statusReason,
  statusDraftIsDirty,
  updatePending,
  onSelectedStatusChange,
  onStatusReasonChange,
  onSubmit,
}: ReferralStatusSectionProps) {
  const copy = getReferralCopy(lang);
  const statusGuidanceCopy = getAdminStatusGuidanceCopy(lang);
  const statusReasonIsValid = statusReason.trim().length >= 3;

  if (manualStatusTargets.length === 0) {
    return null;
  }

  return (
    <SectionBox
      title={
        isScheduledCompletion
          ? statusGuidanceCopy.referral.completionTitle
          : statusGuidanceCopy.referral.manualCorrectionTitle
      }
      collapsible={!isScheduledCompletion}
    >
      <div className="space-y-2">
        <p className="text-xs leading-5 text-muted-foreground">
          {isScheduledCompletion
            ? statusGuidanceCopy.referral.completionDescription
            : statusGuidanceCopy.referral.manualCorrectionDescription}
        </p>
        {isScheduledCompletion ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {statusGuidanceCopy.referral.completionNoAutoNotice}
          </p>
        ) : (
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={selectedStatus}
            onChange={event =>
              onSelectedStatusChange(event.target.value as ReferralOrderStatus)
            }
          >
            {manualStatusTargets.map(status => (
              <option key={status} value={status}>
                {getReferralStatusLabel(status, lang)}
              </option>
            ))}
          </select>
        )}
        <FieldShell
          label={
            isScheduledCompletion
              ? statusGuidanceCopy.referral.completionReasonLabel
              : copy.admin.reason
          }
        >
          <Textarea
            className="min-h-20 px-2 py-1 text-sm leading-tight"
            value={statusReason}
            onChange={event => onStatusReasonChange(event.target.value)}
            placeholder={
              isScheduledCompletion
                ? statusGuidanceCopy.referral.completionReasonLabel
                : copy.admin.reason
            }
          />
        </FieldShell>
        {statusDraftIsDirty ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {statusGuidanceCopy.referral.statusDraftSaved}
          </p>
        ) : null}
        <Button
          size="sm"
          variant={isScheduledCompletion ? "default" : "outline"}
          disabled={
            updatePending ||
            !manualStatusTargets.includes(selectedStatus) ||
            !statusReasonIsValid
          }
          onClick={onSubmit}
        >
          {isScheduledCompletion
            ? statusGuidanceCopy.referral.completionAction
            : copy.admin.updateStatus}
        </Button>
        <p
          className={cn(
            "text-xs leading-5",
            statusReasonIsValid
              ? "text-muted-foreground"
              : "text-amber-700 dark:text-amber-300"
          )}
        >
          {statusGuidanceCopy.reasonRequirement}
        </p>
      </div>
    </SectionBox>
  );
}
