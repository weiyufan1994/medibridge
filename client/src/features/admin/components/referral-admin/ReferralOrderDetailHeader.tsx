import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatReferralDateTime,
  getReferralCopy,
  getReferralStatusLabel,
} from "@/features/referrals";
import type { ReferralOrderStatus } from "@shared/referrals";
import { getReferralAdminStatusTone } from "../../referralAdminPresentation";
import { AdminStatusBadge } from "../AdminStatusBadge";
import { SummaryPill } from "./ReferralAdminPrimitives";

type ReferralOrderDetailHeaderProps = {
  lang: "en" | "zh";
  orderId: number;
  status: ReferralOrderStatus;
  manualFulfillmentRequired: boolean;
  patientEmail: string | null;
  selectedAssignee: string;
  selectedContactName: string | null;
  paymentStatus: string;
  hospitalName: string;
  departmentName: string;
  consultationTime: Date | null;
  hasLocalHospitalMapping: boolean;
  usesReferralDrawer: boolean;
  onClose: () => void;
};

export function ReferralOrderDetailHeader({
  lang,
  orderId,
  status,
  manualFulfillmentRequired,
  patientEmail,
  selectedAssignee,
  selectedContactName,
  paymentStatus,
  hospitalName,
  departmentName,
  consultationTime,
  hasLocalHospitalMapping,
  usesReferralDrawer,
  onClose,
}: ReferralOrderDetailHeaderProps) {
  const copy = getReferralCopy(lang);

  return (
    <div className="shrink-0 border-b border-admin-border bg-admin-surface">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="referral-order-detail-title"
                className="text-sm font-semibold text-foreground"
              >
                #{orderId}
              </h3>
              <AdminStatusBadge
                label={getReferralStatusLabel(status, lang)}
                tone={getReferralAdminStatusTone(status)}
              />
              {manualFulfillmentRequired ? (
                <Badge className="border border-amber-200 bg-amber-50 px-2 py-0 text-[11px] text-amber-800">
                  {copy.admin.manualFulfillmentBadge}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-foreground">
              {patientEmail ?? copy.common.notAvailable}
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="xl:hidden"
            aria-label={copy.common.cancel}
            autoFocus={usesReferralDrawer}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>

          <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            <SummaryPill
              label={copy.orderDetail.assignedAgent}
              value={selectedAssignee}
            />
            <SummaryPill
              label={copy.orderDetail.selectedContact}
              value={selectedContactName ?? copy.admin.contactPending}
            />
            <SummaryPill
              label={copy.admin.paymentStatus}
              value={paymentStatus}
            />
            <SummaryPill
              label={copy.orderDetail.selectedHospital}
              value={hospitalName || copy.common.notAvailable}
            />
            <SummaryPill
              label={copy.selection.recommendedDepartment}
              value={departmentName || copy.common.notAvailable}
            />
            <SummaryPill
              label={copy.orderDetail.consultationTime}
              value={formatReferralDateTime(consultationTime, lang)}
            />
          </div>
        </div>

        {manualFulfillmentRequired || !hasLocalHospitalMapping ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-tight text-amber-900">
            {manualFulfillmentRequired
              ? copy.admin.manualFulfillmentDetail
              : copy.admin.noLocalHospitalMapping}
          </div>
        ) : null}

        <p className="mt-3 text-xs leading-tight text-muted-foreground">
          {copy.admin.detailSummary}
        </p>
      </div>

      <div className="border-t border-admin-border px-3 py-2">
        <TabsList className="grid h-9 w-full grid-cols-3 rounded-lg border border-admin-border bg-admin-surface-muted p-1">
          <TabsTrigger
            value="operations"
            className="rounded-md px-2 py-1 text-sm"
          >
            {copy.admin.detailTabs.operations}
          </TabsTrigger>
          <TabsTrigger value="patient" className="rounded-md px-2 py-1 text-sm">
            {copy.admin.detailTabs.patient}
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-md px-2 py-1 text-sm"
          >
            {copy.admin.detailTabs.timeline}
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
