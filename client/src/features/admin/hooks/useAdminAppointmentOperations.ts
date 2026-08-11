import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { AdminBatchActionResult } from "@/features/admin/types";
import {
  buildAdminBatchMutationInput,
  createAdminOperationRequestId,
  isAdminBatchActionAllowed,
  type AdminBatchActionInput,
} from "./adminAppointmentOperationHelpers";

type TranslateFn = (zh: string, en: string) => string;

export function useAdminAppointmentOperations({
  canMutateAdmin,
  canResendAccessLink,
  selectedAppointmentIds,
  tr,
  toUiError,
  refreshAdminData,
}: {
  canMutateAdmin: boolean;
  canResendAccessLink: boolean;
  selectedAppointmentIds: number[];
  tr: TranslateFn;
  toUiError: (message?: string) => string;
  refreshAdminData: () => Promise<void>;
}) {
  const [batchLastResult, setBatchLastResult] = useState<
    AdminBatchActionResult[] | null
  >([]);

  const adminBatchMutation =
    trpc.system.adminBatchAppointmentsAction.useMutation({
      onSuccess: result => {
        setBatchLastResult(result.results);
        toast.success(
          tr(
            `批量处理完成：成功 ${result.summary.success}，跳过 ${result.summary.skipped}，失败 ${result.summary.failed}`,
            `Batch done: ${result.summary.success} success, ${result.summary.skipped} skipped, ${result.summary.failed} failed`
          )
        );
        refreshAdminData().catch(() => {
          toast.error(
            tr(
              "刷新列表失败，请重试。",
              "Failed to refresh list. Please retry."
            )
          );
        });
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const webhookMutation = trpc.system.adminWebhookReplay.useMutation({
    onSuccess: result => {
      if (result.ok) {
        toast.success(tr("Webhook 重试成功。", "Webhook replay completed."));
      } else {
        toast.success(
          tr("Webhook 重试已去重。", "Webhook replay skipped by idempotency.")
        );
      }
      void refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });

  const executeBatch = (input: AdminBatchActionInput) => {
    if (selectedAppointmentIds.length === 0) {
      toast.error(
        tr("请先选择至少一条预约。", "Select at least one appointment.")
      );
      return;
    }
    if (
      !isAdminBatchActionAllowed(input.action, {
        canMutateAdmin,
        canResendAccessLink,
      })
    ) {
      toast.message(
        tr(
          "当前角色无权执行该批量动作。",
          "Current role cannot execute this batch action."
        )
      );
      return;
    }
    return adminBatchMutation.mutateAsync(
      buildAdminBatchMutationInput(
        selectedAppointmentIds,
        input,
        createAdminOperationRequestId
      )
    );
  };

  return {
    batchAppointmentsMutation: {
      isPending: adminBatchMutation.isPending,
      executeBatch,
      lastResult: batchLastResult,
    },
    webhookReplayMutation: {
      isPending: webhookMutation.isPending,
      replayByEvent: (params: { eventId?: string; appointmentId?: number }) => {
        webhookMutation.mutate({
          eventId: params.eventId,
          appointmentId: params.appointmentId,
          replayKey: createAdminOperationRequestId(),
        });
      },
    },
  };
}
