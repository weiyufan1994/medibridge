import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  canMutateAdmin: boolean;
  canReinitiatePayment: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  handleCopyDebugSnapshot: () => Promise<void>;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  manualScheduledAt: string;
  setManualScheduledAt: (value: string) => void;
  setScheduleToNow: () => void;
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
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
  selectedAppointmentId,
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
  manualStatus,
  setManualStatus,
  manualPaymentStatus,
  setManualPaymentStatus,
  manualStatusReason,
  setManualStatusReason,
  manualScheduledAt,
  setManualScheduledAt,
  setScheduleToNow,
  appointmentStatusOptions,
  paymentStatusOptions,
  applyManualStatusUpdate,
  applyManualScheduleUpdate,
  updateStatusMutation,
  updateScheduleMutation,
  generateSummaryMutation,
  exportSummaryPdfMutation,
  visitSummaryQuery,
  issuedLinks,
}: ActionsSectionProps) {
  const reinitiateDisabledReason = !canReinitiatePayment
    ? tr("仅管理员可重新发起支付。", "Only admin can re-initiate payment.")
    : "";
  const resendLinkDisabledReason = !canResendAccessLink
    ? tr("仅管理员与 ops 可重发访问链接。", "Only admin/ops can resend access links.")
    : "";
  const issueLinksDisabledReason = !canIssueAccessLinks
    ? tr("仅管理员与 ops 可签发新访问链接。", "Only admin/ops can issue new access links.")
    : "";
  const manualUpdateDisabledReason = !canMutateAdmin
    ? tr("仅管理员可执行预约状态/财务更新。", "Only admin can update appointment status/payment.")
    : "";

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
          disabled={!canReinitiatePayment || resendPaymentMutation.isPending}
          title={reinitiateDisabledReason || undefined}
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
          disabled={!canResendAccessLink || resendAccessLinkMutation.isPending}
          title={resendLinkDisabledReason || undefined}
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
          disabled={!canIssueAccessLinks || issueLinksMutation.isPending}
          title={issueLinksDisabledReason || undefined}
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
        {!canMutateAdmin ? (
          <p className="text-xs text-muted-foreground">
            {manualUpdateDisabledReason}
          </p>
        ) : null}
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
            disabled={!canMutateAdmin || updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending
              ? tr("更新中...", "Updating...")
              : tr("应用状态", "Apply Status")}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("测试预约时间", "Test Appointment Time")}</p>
        {!canMutateAdmin ? (
          <p className="text-xs text-muted-foreground">
            {manualUpdateDisabledReason}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Input
            type="datetime-local"
            value={manualScheduledAt}
            onChange={event => setManualScheduledAt(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={setScheduleToNow}
            disabled={!canMutateAdmin || updateScheduleMutation.isPending}
          >
            {tr("设为当前时间", "Set to now")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={applyManualScheduleUpdate}
            disabled={!canMutateAdmin || updateScheduleMutation.isPending}
          >
            {updateScheduleMutation.isPending
              ? tr("保存中...", "Saving...")
              : tr("保存预约时间", "Save schedule")}
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
              <p className="mb-1 text-xs font-medium text-slate-700">{tr("中文", "Chinese")}</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summary.zh}
              </pre>
            </div>
            <div className="rounded bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium text-slate-700">{tr("English", "English")}</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summary.en}
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
          <p className="font-medium">{tr("签发链接", "Issued Links")}</p>
          <p className="mt-1 break-all">{tr("患者：", "Patient: ")} {issuedLinks.patientLink}</p>
          <p className="mt-1 break-all">{tr("医生：", "Doctor: ")} {issuedLinks.doctorLink}</p>
        </div>
      ) : null}
    </>
  );
}
