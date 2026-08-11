import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadBase64File } from "../utils/adminFormatting";
import type { useAdminAppointmentDetailState } from "./useAdminAppointmentDetailState";

type DetailState = ReturnType<typeof useAdminAppointmentDetailState>;
type TranslateFn = (zh: string, en: string) => string;

export function useAdminAppointmentMutations({
  tr,
  toUiError,
  refreshAdminData,
  detailState,
}: {
  tr: TranslateFn;
  toUiError: (message?: string) => string;
  refreshAdminData: () => Promise<void>;
  detailState: DetailState;
}) {
  const resendPaymentMutation = trpc.system.adminReinitiatePayment.useMutation({
    onError: error => {
      toast.error(toUiError(error.message));
    },
    onSuccess: async result => {
      toast.success(tr("正在跳转到支付页...", "Redirecting to checkout..."));
      await refreshAdminData();
      if (typeof window !== "undefined") {
        window.location.href = result.checkoutUrl;
      }
    },
  });
  const resendAccessLinkMutation =
    trpc.system.adminResendAccessLink.useMutation({
      onSuccess: async () => {
        toast.success(tr("访问链接邮件已重发。", "Access link email resent."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const issueLinksMutation = trpc.system.adminIssueAccessLinks.useMutation({
    onSuccess: async result => {
      detailState.setIssuedLinks({
        patientLink: result.patientLink,
        doctorLink: result.doctorLink,
      });
      toast.success(tr("新链接已签发。", "New links issued."));
      await refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const notifyDoctorFollowupMutation =
    trpc.system.adminNotifyDoctorFollowup.useMutation({
      onSuccess: () => {
        toast.success(
          tr("已发送医生跟进提醒。", "Doctor follow-up reminder sent.")
        );
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const updateStatusMutation =
    trpc.system.adminUpdateAppointmentStatus.useMutation({
      onSuccess: async () => {
        toast.success(tr("预约状态已更新。", "Appointment status updated."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const updateScheduleMutation =
    trpc.system.adminUpdateAppointmentSchedule.useMutation({
      onSuccess: async () => {
        toast.success(tr("预约时间已更新。", "Appointment schedule updated."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const generateSummaryMutation =
    trpc.system.adminGenerateVisitSummary.useMutation({
      onSuccess: () => {
        toast.success(tr("会后总结已生成。", "Visit summary generated."));
        void detailState.visitSummaryQuery.refetch();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const exportSummaryPdfMutation =
    trpc.system.adminExportVisitSummaryPdf.useMutation({
      onSuccess: result => {
        downloadBase64File(result.base64, result.mimeType, result.filename);
        toast.success(tr("PDF 已导出。", "PDF exported."));
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });

  return {
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    notifyDoctorFollowupMutation,
    updateStatusMutation,
    updateScheduleMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
  };
}
