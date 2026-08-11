import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatReferralDateTime,
  getReferralCopy,
  getReferralStatusLabel,
} from "@/features/referrals";
import { getLocalizedText } from "@/lib/i18n";
import type { ReferralOrderStatus } from "@shared/referrals";
import type { LocalizedText } from "@shared/types";
import {
  formatReferralWaitingDuration,
  getReferralAdminStatusTone,
  shouldShowReferralWaitDuration,
} from "../../referralAdminPresentation";
import { AdminStatusBadge } from "../AdminStatusBadge";

type ReferralOrderListItem = {
  id: number;
  patientEmail: string | null;
  status: ReferralOrderStatus;
  consultationTime: Date | null;
  assignedAgentId: number | null;
  hospitalName: LocalizedText;
  departmentName: LocalizedText;
  manualFulfillmentRequired: boolean;
  updatedAt: Date;
  urgencyMinutes: number;
};

type ReferralOrderListProps = {
  lang: "en" | "zh";
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  items: ReferralOrderListItem[];
  selectedOrderId: number | null;
  page: number;
  totalPages: number;
  onSelectOrder: (orderId: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function ReferralOrderList({
  lang,
  isLoading,
  hasError,
  errorMessage,
  items,
  selectedOrderId,
  page,
  totalPages,
  onSelectOrder,
  onPreviousPage,
  onNextPage,
}: ReferralOrderListProps) {
  const copy = getReferralCopy(lang);

  return (
    <div className="flex min-h-0 flex-col border-r border-admin-border">
      <div className="border-b border-admin-border px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {copy.admin.orderListTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {copy.admin.filtersTitle}
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            {copy.common.loading}
          </div>
        ) : hasError ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : items.length > 0 ? (
          <div className="divide-y divide-admin-border">
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectOrder(item.id)}
                className={[
                  "w-full px-3 py-2 text-left text-sm leading-tight transition-colors",
                  selectedOrderId === item.id
                    ? "bg-admin-surface-muted"
                    : "hover:bg-admin-surface-muted",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        #{item.id} ·{" "}
                        {getLocalizedText({
                          lang,
                          value: item.hospitalName,
                        }).trim() || copy.common.notAvailable}
                      </span>
                      {item.manualFulfillmentRequired ? (
                        <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {getLocalizedText({
                        lang,
                        value: item.departmentName,
                      }).trim() || copy.common.notAvailable}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.patientEmail ?? copy.common.notAvailable}
                    </p>
                  </div>
                  <AdminStatusBadge
                    label={getReferralStatusLabel(item.status, lang)}
                    tone={getReferralAdminStatusTone(item.status)}
                  />
                </div>

                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
                  {shouldShowReferralWaitDuration(item.status) ? (
                    <p>
                      {copy.admin.urgencyMinutes.replace(
                        "{{duration}}",
                        formatReferralWaitingDuration(item.urgencyMinutes, lang)
                      )}
                    </p>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <p>{formatReferralDateTime(item.updatedAt, lang)}</p>
                  <p>
                    {copy.orderDetail.consultationTime}:{" "}
                    {formatReferralDateTime(item.consultationTime, lang)}
                  </p>
                  <p>
                    {item.assignedAgentId
                      ? String(item.assignedAgentId)
                      : copy.admin.unassigned}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            {copy.admin.noOrders}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-admin-border px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={onPreviousPage}
            >
              {copy.admin.prevPage}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={onNextPage}
            >
              {copy.admin.nextPage}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
