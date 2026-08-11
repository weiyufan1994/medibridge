import { Loader2 } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { getReferralCopy } from "@/features/referrals";
import { getLocalizedText } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { useReferralAdminActions } from "../../hooks/useReferralAdminActions";
import type { useReferralAdminDrafts } from "../../hooks/useReferralAdminDrafts";
import type { useReferralAdminSelection } from "../../hooks/useReferralAdminSelection";
import { ReferralAdminOperationsTab } from "./ReferralAdminOperationsTab";
import { ReferralAdminRefundTab } from "./ReferralAdminRefundTab";
import { ReferralOrderDetailHeader } from "./ReferralOrderDetailHeader";
import { ReferralPatientSection } from "./ReferralPatientSection";
import { ReferralTimelineSection } from "./ReferralTimelineSection";

type SelectionController = ReturnType<typeof useReferralAdminSelection>;
type DraftController = ReturnType<typeof useReferralAdminDrafts>;
type ActionController = ReturnType<typeof useReferralAdminActions>;

type ReferralAdminOrderDetailProps = {
  lang: "en" | "zh";
  currentUserId: number | null;
  selection: SelectionController;
  drafts: DraftController;
  actions: ActionController;
};

export function ReferralAdminOrderDetail({
  lang,
  currentUserId,
  selection,
  drafts,
  actions,
}: ReferralAdminOrderDetailProps) {
  const copy = getReferralCopy(lang);
  const selectedOrder = selection.detailQuery.data;
  const orderState = selectedOrder?.order ?? null;
  const selectedAssignee = (() => {
    if (!orderState?.assignedAgentId) {
      return copy.admin.unassigned;
    }

    const matchedUser = selection.assignableAgentsQuery.data?.find(
      user => user.id === orderState.assignedAgentId
    );
    return (
      matchedUser?.email ||
      matchedUser?.name ||
      String(orderState.assignedAgentId)
    );
  })();
  const selectedHospitalName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.hospital.name }).trim() ||
      copy.common.notAvailable);
  const selectedDepartmentName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.department.name }).trim() ||
      copy.common.notAvailable);

  return (
    <>
      {selection.usesReferralDrawer && selection.selectedOrderId ? (
        <button
          type="button"
          className="fixed inset-0 top-16 z-30 bg-black/20 xl:hidden"
          aria-label={copy.common.cancel}
          onClick={() => selection.setSelectedOrderId(null)}
        />
      ) : null}

      <div
        role={
          selection.usesReferralDrawer && selection.selectedOrderId
            ? "dialog"
            : undefined
        }
        aria-modal={
          selection.usesReferralDrawer && selection.selectedOrderId
            ? true
            : undefined
        }
        aria-labelledby={
          selection.usesReferralDrawer && selection.selectedOrderId
            ? "referral-order-detail-title"
            : undefined
        }
        className={cn(
          "min-h-0 overflow-hidden bg-admin-surface",
          "max-xl:fixed max-xl:inset-y-16 max-xl:right-0 max-xl:z-40 max-xl:w-[min(92vw,760px)] max-xl:border-l max-xl:border-admin-border max-xl:shadow-2xl",
          !selection.selectedOrderId && "max-xl:hidden"
        )}
      >
        {!selection.selectedOrderId ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            {copy.admin.noSelection}
          </div>
        ) : selection.detailQuery.isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 px-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.common.loading}
          </div>
        ) : selection.detailQuery.error || !selectedOrder || !orderState ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-rose-600">
            {selection.detailQuery.error?.message || copy.admin.loadFailed}
          </div>
        ) : (
          <Tabs
            value={selection.detailTab}
            onValueChange={value =>
              selection.setDetailTab(
                value as "operations" | "patient" | "refund" | "timeline"
              )
            }
            className="flex h-full min-h-0 flex-col gap-0"
          >
            <ReferralOrderDetailHeader
              lang={lang}
              orderId={orderState.id}
              status={orderState.status}
              manualFulfillmentRequired={orderState.manualFulfillmentRequired}
              patientEmail={selectedOrder.patient.email}
              selectedAssignee={selectedAssignee}
              selectedContactName={selectedOrder.contact?.name ?? null}
              paymentStatus={orderState.paymentStatus}
              hospitalName={selectedHospitalName || copy.common.notAvailable}
              departmentName={
                selectedDepartmentName || copy.common.notAvailable
              }
              consultationTime={orderState.consultationTime}
              hasLocalHospitalMapping={Boolean(selectedOrder.hospital.id)}
              usesReferralDrawer={selection.usesReferralDrawer}
              onClose={() => selection.setSelectedOrderId(null)}
            />

            <ReferralAdminOperationsTab
              lang={lang}
              currentUserId={currentUserId}
              selectedOrder={selectedOrder}
              selection={selection}
              drafts={drafts}
              actions={actions}
            />

            <ReferralPatientSection
              lang={lang}
              patientEmail={selectedOrder.patient.email}
              hospitalName={selectedHospitalName}
              departmentName={selectedDepartmentName}
              totalAmount={orderState.totalAmount}
              currency={orderState.currency}
              triageSummary={selectedOrder.triageSummary}
              recommendationReason={selectedOrder.recommendationReason}
            />

            <ReferralAdminRefundTab
              lang={lang}
              selectedOrder={selectedOrder}
              selection={selection}
              actions={actions}
            />

            <ReferralTimelineSection
              lang={lang}
              timeline={selectedOrder.timeline}
              operations={selectedOrder.operations}
              notificationFailures={selectedOrder.notificationFailures}
            />
          </Tabs>
        )}
      </div>
    </>
  );
}
