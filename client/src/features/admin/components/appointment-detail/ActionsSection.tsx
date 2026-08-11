import type {
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  IssueLinksMutation,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
  UpdateScheduleMutation,
  UpdateStatusMutation,
  VisitSummaryQuery,
} from "@/features/admin/types";
import type { AdminLang } from "@/features/admin/copy";
import { AppointmentQuickActions } from "./AppointmentQuickActions";
import { AppointmentSchedulePanel } from "./AppointmentSchedulePanel";
import { AppointmentStatusPanel } from "./AppointmentStatusPanel";
import { AppointmentSummaryPanel } from "./AppointmentSummaryPanel";

type TranslateFn = (zh: string, en: string) => string;

type ActionsSectionProps = {
  tr: TranslateFn;
  lang: AdminLang;
  selectedAppointmentId: number;
  hideQuickActions?: boolean;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  canMutateAdmin: boolean;
  canReinitiatePayment: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  handleCopyDebugSnapshot: () => Promise<void>;
  currentStatus: string;
  currentPaymentStatus: string;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  manualScheduledAt: string;
  setManualScheduledAt: (value: string) => void;
  setScheduleToNow: () => void;
  applyManualStatusUpdate: () => void;
  applyManualScheduleUpdate: () => void;
  updateStatusMutation: UpdateStatusMutation;
  updateScheduleMutation: UpdateScheduleMutation;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  visitSummaryQuery: VisitSummaryQuery;
  issuedLinks: { patientLink: string; doctorLink: string } | null;
};

export function ActionsSection({
  tr,
  lang,
  selectedAppointmentId,
  hideQuickActions = false,
  beforeReinitiatePayment,
  beforeResendAccessLink,
  beforeIssueLinks,
  resendPaymentMutation,
  resendAccessLinkMutation,
  issueLinksMutation,
  canMutateAdmin,
  canReinitiatePayment,
  canResendAccessLink,
  canIssueAccessLinks,
  handleCopyDebugSnapshot,
  currentStatus,
  currentPaymentStatus,
  manualStatus,
  setManualStatus,
  manualPaymentStatus,
  setManualPaymentStatus,
  manualStatusReason,
  setManualStatusReason,
  manualScheduledAt,
  setManualScheduledAt,
  setScheduleToNow,
  applyManualStatusUpdate,
  applyManualScheduleUpdate,
  updateStatusMutation,
  updateScheduleMutation,
  generateSummaryMutation,
  exportSummaryPdfMutation,
  visitSummaryQuery,
  issuedLinks,
}: ActionsSectionProps) {
  return (
    <>
      <AppointmentQuickActions
        tr={tr}
        lang={lang}
        appointmentId={selectedAppointmentId}
        hideQuickActions={hideQuickActions}
        beforeReinitiatePayment={beforeReinitiatePayment}
        beforeResendAccessLink={beforeResendAccessLink}
        beforeIssueLinks={beforeIssueLinks}
        resendPaymentMutation={resendPaymentMutation}
        resendAccessLinkMutation={resendAccessLinkMutation}
        issueLinksMutation={issueLinksMutation}
        canReinitiatePayment={canReinitiatePayment}
        canResendAccessLink={canResendAccessLink}
        canIssueAccessLinks={canIssueAccessLinks}
        handleCopyDebugSnapshot={handleCopyDebugSnapshot}
      />

      <AppointmentStatusPanel
        tr={tr}
        lang={lang}
        appointmentId={selectedAppointmentId}
        canMutateAdmin={canMutateAdmin}
        currentStatus={currentStatus}
        currentPaymentStatus={currentPaymentStatus}
        manualStatus={manualStatus}
        setManualStatus={setManualStatus}
        manualPaymentStatus={manualPaymentStatus}
        setManualPaymentStatus={setManualPaymentStatus}
        manualStatusReason={manualStatusReason}
        setManualStatusReason={setManualStatusReason}
        applyManualStatusUpdate={applyManualStatusUpdate}
        updateStatusMutation={updateStatusMutation}
      />

      <AppointmentSchedulePanel
        tr={tr}
        canMutateAdmin={canMutateAdmin}
        manualScheduledAt={manualScheduledAt}
        setManualScheduledAt={setManualScheduledAt}
        setScheduleToNow={setScheduleToNow}
        applyManualScheduleUpdate={applyManualScheduleUpdate}
        updateScheduleMutation={updateScheduleMutation}
      />

      <AppointmentSummaryPanel
        tr={tr}
        appointmentId={selectedAppointmentId}
        generateSummaryMutation={generateSummaryMutation}
        exportSummaryPdfMutation={exportSummaryPdfMutation}
        visitSummaryQuery={visitSummaryQuery}
      />

      {issuedLinks ? (
        <div className="rounded border bg-admin-surface-muted p-3 text-xs">
          <p className="font-medium">{tr("签发链接", "Issued Links")}</p>
          <p className="mt-1 break-all">
            {tr("患者：", "Patient: ")} {issuedLinks.patientLink}
          </p>
          <p className="mt-1 break-all">
            {tr("医生：", "Doctor: ")} {issuedLinks.doctorLink}
          </p>
        </div>
      ) : null}
    </>
  );
}
