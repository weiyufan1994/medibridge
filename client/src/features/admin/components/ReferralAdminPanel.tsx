import { useLanguage } from "@/contexts/LanguageContext";
import { useReferralAdminActions } from "../hooks/useReferralAdminActions";
import { useReferralAdminDrafts } from "../hooks/useReferralAdminDrafts";
import { useReferralAdminSelection } from "../hooks/useReferralAdminSelection";
import { ReferralAdminFilters } from "./referral-admin/ReferralAdminFilters";
import { ReferralAdminOrderDetail } from "./referral-admin/ReferralAdminOrderDetail";
import { ReferralOrderList } from "./referral-admin/ReferralOrderList";

type ReferralAdminPanelProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
  requestedOrderId?: number | null;
};

export function ReferralAdminPanel({
  currentUserId,
  requestedOrderId,
}: ReferralAdminPanelProps) {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const selection = useReferralAdminSelection(requestedOrderId);
  const drafts = useReferralAdminDrafts({
    selectedOrderId: selection.selectedOrderId,
    detail: selection.detailQuery.data,
  });
  const actions = useReferralAdminActions({
    lang,
    refreshData: selection.refreshReferralAdminData,
    onStatusSaved: drafts.handleStatusSaved,
    onConsultationSaved: drafts.handleConsultationSaved,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <ReferralAdminFilters
        lang={lang}
        statusFilter={selection.statusFilter}
        sortDirection={selection.sortDirection}
        assignedToMe={selection.assignedToMe}
        onStatusFilterChange={selection.updateStatusFilter}
        onSortDirectionChange={selection.updateSortDirection}
        onAssignedToMeChange={selection.updateAssignedToMe}
        onRefresh={() => {
          void selection.refreshReferralAdminData();
        }}
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-admin-border bg-admin-surface xl:grid-cols-[minmax(320px,35%)_minmax(0,65%)]">
        <ReferralOrderList
          lang={lang}
          isLoading={selection.ordersQuery.isLoading}
          hasError={Boolean(selection.ordersQuery.error)}
          errorMessage={selection.ordersQuery.error?.message}
          items={selection.ordersQuery.data?.items ?? []}
          selectedOrderId={selection.selectedOrderId}
          page={selection.ordersQuery.data?.page ?? selection.page}
          totalPages={selection.ordersQuery.data?.totalPages ?? 1}
          onSelectOrder={selection.setSelectedOrderId}
          onPreviousPage={() =>
            selection.setPage(value => Math.max(1, value - 1))
          }
          onNextPage={() =>
            selection.setPage(value =>
              Math.min(
                selection.ordersQuery.data?.totalPages ?? value,
                value + 1
              )
            )
          }
        />

        <ReferralAdminOrderDetail
          lang={lang}
          currentUserId={currentUserId}
          selection={selection}
          drafts={drafts}
          actions={actions}
        />
      </div>
    </div>
  );
}
