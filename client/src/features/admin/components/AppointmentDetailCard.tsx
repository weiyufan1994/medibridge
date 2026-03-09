import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminSuggestion } from "@/features/admin/risk";
import { OverviewSection } from "@/features/admin/components/appointment-detail/OverviewSection";
import { DiagnosticsSection } from "@/features/admin/components/appointment-detail/DiagnosticsSection";
import { ActionsSection } from "@/features/admin/components/appointment-detail/ActionsSection";
import type {
  AppointmentDetailData,
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  IssueLinksMutation,
  QueryState,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
  UpdateStatusMutation,
  VisitSummaryQuery,
} from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type AppointmentDetailCardProps = {
  tr: TranslateFn;
  lang: "zh" | "en";
  locale: string;
  selectedAppointmentId: number | null;
  appointmentDetailQuery: QueryState<AppointmentDetailData>;
  risks: Array<{ code: string; level: "critical" | "warning"; message: string }>;
  suggestions: AdminSuggestion[];
  runSuggestedAction: (suggestion: AdminSuggestion) => void;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  handleCopyDebugSnapshot: () => Promise<void>;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  applyManualStatusUpdate: () => void;
  updateStatusMutation: UpdateStatusMutation;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  visitSummaryQuery: VisitSummaryQuery;
  issuedLinks: { patientLink: string; doctorLink: string } | null;
};

export function AppointmentDetailCard({
  tr,
  lang,
  locale,
  selectedAppointmentId,
  appointmentDetailQuery,
  risks,
  suggestions,
  runSuggestedAction,
  beforeReinitiatePayment,
  beforeResendAccessLink,
  beforeIssueLinks,
  resendPaymentMutation,
  resendAccessLinkMutation,
  issueLinksMutation,
  handleCopyDebugSnapshot,
  manualStatus,
  setManualStatus,
  manualPaymentStatus,
  setManualPaymentStatus,
  manualStatusReason,
  setManualStatusReason,
  appointmentStatusOptions,
  paymentStatusOptions,
  applyManualStatusUpdate,
  updateStatusMutation,
  generateSummaryMutation,
  exportSummaryPdfMutation,
  visitSummaryQuery,
  issuedLinks,
}: AppointmentDetailCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Appointment Detail
          {selectedAppointmentId ? ` #${selectedAppointmentId}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!selectedAppointmentId ? (
          <p className="text-sm text-muted-foreground">
            {tr("点击一条预约记录查看详情与可执行动作。", "Click an appointment row to view details and admin actions.")}
          </p>
        ) : appointmentDetailQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载预约详情...", "Loading appointment detail...")}
          </div>
        ) : appointmentDetailQuery.error ? (
          <p className="text-sm text-destructive">{appointmentDetailQuery.error.message}</p>
        ) : !appointmentDetailQuery.data ? (
          <p className="text-sm text-muted-foreground">
            {tr("预约详情暂无数据。", "No appointment detail data available.")}
          </p>
        ) : (
          <div className="space-y-4">
            <OverviewSection
              tr={tr}
              locale={locale}
              detailData={appointmentDetailQuery.data}
              risks={risks}
              suggestions={suggestions}
              runSuggestedAction={runSuggestedAction}
            />

            <DiagnosticsSection
              tr={tr}
              lang={lang}
              locale={locale}
              detailData={appointmentDetailQuery.data}
            />

            <ActionsSection
              tr={tr}
              selectedAppointmentId={selectedAppointmentId}
              beforeReinitiatePayment={beforeReinitiatePayment}
              beforeResendAccessLink={beforeResendAccessLink}
              beforeIssueLinks={beforeIssueLinks}
              resendPaymentMutation={resendPaymentMutation}
              resendAccessLinkMutation={resendAccessLinkMutation}
              issueLinksMutation={issueLinksMutation}
              handleCopyDebugSnapshot={handleCopyDebugSnapshot}
              manualStatus={manualStatus}
              setManualStatus={setManualStatus}
              manualPaymentStatus={manualPaymentStatus}
              setManualPaymentStatus={setManualPaymentStatus}
              manualStatusReason={manualStatusReason}
              setManualStatusReason={setManualStatusReason}
              appointmentStatusOptions={appointmentStatusOptions}
              paymentStatusOptions={paymentStatusOptions}
              applyManualStatusUpdate={applyManualStatusUpdate}
              updateStatusMutation={updateStatusMutation}
              generateSummaryMutation={generateSummaryMutation}
              exportSummaryPdfMutation={exportSummaryPdfMutation}
              visitSummaryQuery={visitSummaryQuery}
              issuedLinks={issuedLinks}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
