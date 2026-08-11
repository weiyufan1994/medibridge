import { Button } from "@/components/ui/button";
import { getReferralCopy, getReferralStatusLabel } from "@/features/referrals";
import {
  REFERRAL_ORDER_STATUS_VALUES,
  type ReferralOrderStatus,
} from "@shared/referrals";
import { FieldShell } from "./ReferralAdminPrimitives";

type ReferralAdminFiltersProps = {
  lang: "en" | "zh";
  statusFilter: ReferralOrderStatus | "all";
  sortDirection: "asc" | "desc";
  assignedToMe: boolean;
  onStatusFilterChange: (value: ReferralOrderStatus | "all") => void;
  onSortDirectionChange: (value: "asc" | "desc") => void;
  onAssignedToMeChange: (value: boolean) => void;
  onRefresh: () => void;
};

export function ReferralAdminFilters({
  lang,
  statusFilter,
  sortDirection,
  assignedToMe,
  onStatusFilterChange,
  onSortDirectionChange,
  onAssignedToMeChange,
  onRefresh,
}: ReferralAdminFiltersProps) {
  const copy = getReferralCopy(lang);

  return (
    <div className="shrink-0 rounded-2xl border border-admin-border bg-admin-surface px-3 py-3">
      <div className="grid gap-2 xl:grid-cols-[1fr_180px_180px_auto]">
        <FieldShell label={copy.admin.statusFilter}>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={statusFilter}
            onChange={event =>
              onStatusFilterChange(
                event.target.value === "all"
                  ? "all"
                  : (event.target.value as ReferralOrderStatus)
              )
            }
          >
            <option value="all">{copy.admin.statusAll}</option>
            {REFERRAL_ORDER_STATUS_VALUES.map(status => (
              <option key={status} value={status}>
                {getReferralStatusLabel(status, lang)}
              </option>
            ))}
          </select>
        </FieldShell>

        <FieldShell label={copy.admin.sortDirection}>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={sortDirection}
            onChange={event =>
              onSortDirectionChange(event.target.value as "asc" | "desc")
            }
          >
            <option value="desc">{copy.admin.sortNewest}</option>
            <option value="asc">{copy.admin.sortOldest}</option>
          </select>
        </FieldShell>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {copy.admin.assignedToMe}
          </span>
          <span className="inline-flex h-8 items-center gap-2 rounded-md border border-input px-2 text-sm">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={event => onAssignedToMeChange(event.target.checked)}
            />
            {copy.admin.assignedToMe}
          </span>
        </label>

        <div className="flex items-end justify-end">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            {copy.admin.refresh}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs leading-tight text-muted-foreground">
        {copy.admin.listSummary}
      </p>
    </div>
  );
}
