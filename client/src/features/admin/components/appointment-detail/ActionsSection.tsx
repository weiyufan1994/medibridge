import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  IssueLinksMutation,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
  UpdateStatusMutation,
  VisitSummaryQuery,
} from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type ActionsSectionProps = {
  tr: TranslateFn;
  selectedAppointmentId: number;
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

export function ActionsSection({
  tr,
  selectedAppointmentId,
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
}: ActionsSectionProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            beforeReinitiatePayment() &&
            resendPaymentMutation.mutate({
              appointmentId: selectedAppointmentId,
            })
          }
          disabled={resendPaymentMutation.isPending}
        >
          {resendPaymentMutation.isPending
            ? tr("正在打开支付页...", "Opening checkout...")
            : tr("重新发起支付", "Re-initiate Payment")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            beforeResendAccessLink() &&
            resendAccessLinkMutation.mutate({
              appointmentId: selectedAppointmentId,
            })
          }
          disabled={resendAccessLinkMutation.isPending}
        >
          {resendAccessLinkMutation.isPending
            ? tr("发送中...", "Sending...")
            : tr("重发访问链接邮件", "Resend Access Link Email")}
        </Button>
        <Button
          type="button"
          onClick={() =>
            beforeIssueLinks() &&
            issueLinksMutation.mutate({
              appointmentId: selectedAppointmentId,
            })
          }
          disabled={issueLinksMutation.isPending}
        >
          {issueLinksMutation.isPending
            ? tr("签发中...", "Issuing...")
            : tr("签发新访问链接", "Issue New Access Links")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void handleCopyDebugSnapshot()}>
          {tr("复制调试快照", "Copy Debug Snapshot")}
        </Button>
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("手动状态更新", "Manual Status Update")}</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={manualStatus}
            onChange={event => setManualStatus(event.target.value)}
          >
            {appointmentStatusOptions
              .filter(option => option)
              .map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={manualPaymentStatus}
            onChange={event => setManualPaymentStatus(event.target.value)}
          >
            {paymentStatusOptions
              .filter(option => option)
              .map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
          <Input
            value={manualStatusReason}
            onChange={event => setManualStatusReason(event.target.value)}
            placeholder={tr("原因", "reason")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={applyManualStatusUpdate}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending
              ? tr("更新中...", "Updating...")
              : tr("应用状态", "Apply Status")}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{tr("会后总结（中/英）", "Post-Visit Summary (ZH/EN)")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                generateSummaryMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  forceRegenerate: true,
                })
              }
              disabled={generateSummaryMutation.isPending}
            >
              {generateSummaryMutation.isPending
                ? tr("生成中...", "Generating...")
                : tr("生成总结", "Generate Summary")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportSummaryPdfMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  lang: "zh",
                })
              }
              disabled={exportSummaryPdfMutation.isPending}
            >
              {tr("导出中文 PDF", "Export ZH PDF")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportSummaryPdfMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  lang: "en",
                })
              }
              disabled={exportSummaryPdfMutation.isPending}
            >
              {tr("导出英文 PDF", "Export EN PDF")}
            </Button>
          </div>
        </div>
        {visitSummaryQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{tr("正在加载总结...", "Loading summary...")}</p>
        ) : visitSummaryQuery.data ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium text-slate-700">中文</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summaryZh}
              </pre>
            </div>
            <div className="rounded bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium text-slate-700">English</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summaryEn}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {tr("尚未生成总结。", "No summary generated yet.")}
          </p>
        )}
      </div>

      {issuedLinks ? (
        <div className="rounded border bg-slate-50 p-3 text-xs">
          <p className="font-medium">Issued Links</p>
          <p className="mt-1 break-all">Patient: {issuedLinks.patientLink}</p>
          <p className="mt-1 break-all">Doctor: {issuedLinks.doctorLink}</p>
        </div>
      ) : null}
    </>
  );
}
