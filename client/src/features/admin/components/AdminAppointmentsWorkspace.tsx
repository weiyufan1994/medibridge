import { getAdminConfirmationCopy } from "@/features/admin/copy";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import { BookingWorkspace, getBookingWorkspaceCopy } from "@/features/booking";
import { AdminAppointmentDetailTabs } from "./AdminAppointmentDetailTabs";

type AdminAppointmentsWorkspaceProps = {
  admin: UseAdminConsoleResult;
  lang: "zh" | "en";
  locale: string;
  tr: (zh: string, en: string) => string;
  permissions: {
    canIssueAccessLinks: boolean;
    canMutateAppointments: boolean;
    canNotifyFollowup: boolean;
    canReinitiatePayment: boolean;
    canReplayWebhook: boolean;
    canResendAccessLink: boolean;
  };
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

export function AdminAppointmentsWorkspace({
  admin,
  lang,
  locale,
  tr,
  permissions,
  requestConfirmation,
}: AdminAppointmentsWorkspaceProps) {
  const bookingItems = (admin.appointmentsQuery.data?.items ?? []).map(
    item => ({
      id: item.id,
      userId: item.userId ?? null,
      email: item.email,
      status: item.status,
      paymentStatus: item.paymentStatus,
      amount: item.amount,
      currency: item.currency,
      doctorId: item.doctorId ?? null,
      triageSessionId: item.triageSessionId ?? null,
      scheduledAt: item.scheduledAt ?? null,
      createdAt: item.createdAt,
      riskFlag: item.hasRisk,
      riskCodes: item.riskCodes,
    })
  );
  const activeBookingItem =
    bookingItems.find(item => item.id === admin.selectedAppointmentId) ?? null;
  const detailMeta = admin.appointmentDetailQuery.data
    ? {
        id: admin.appointmentDetailQuery.data.appointment.id,
        email: admin.appointmentDetailQuery.data.appointment.email,
        status: admin.appointmentDetailQuery.data.appointment.status,
        paymentStatus:
          admin.appointmentDetailQuery.data.appointment.paymentStatus,
        amount: admin.appointmentDetailQuery.data.appointment.amount,
        currency: admin.appointmentDetailQuery.data.appointment.currency,
        scheduledAt: admin.appointmentDetailQuery.data.appointment.scheduledAt,
        riskFlag: activeBookingItem?.riskFlag ?? false,
      }
    : activeBookingItem
      ? {
          id: activeBookingItem.id,
          email: activeBookingItem.email,
          status: activeBookingItem.status,
          paymentStatus: activeBookingItem.paymentStatus,
          amount: activeBookingItem.amount,
          currency: activeBookingItem.currency,
          scheduledAt: activeBookingItem.scheduledAt,
          riskFlag: activeBookingItem.riskFlag,
        }
      : {
          id: null,
          email: null,
          status: null,
          paymentStatus: null,
          amount: null,
          currency: null,
          scheduledAt: null,
          riskFlag: false,
        };
  const copy = getBookingWorkspaceCopy(lang);
  const detailContent =
    admin.selectedAppointmentId && admin.appointmentDetailQuery.data ? (
      <AdminAppointmentDetailTabs
        admin={admin}
        lang={lang}
        locale={locale}
        tr={tr}
        permissions={permissions}
      />
    ) : undefined;
  const stickyActions = [
    {
      kind: "generate_summary_en" as const,
      disabled:
        !admin.selectedAppointmentId || admin.generateSummaryMutation.isPending,
      pending: admin.generateSummaryMutation.isPending,
      onClick: () => {
        if (!admin.selectedAppointmentId) return;
        admin.generateSummaryMutation.mutate({
          appointmentId: admin.selectedAppointmentId,
          forceRegenerate: true,
        });
      },
    },
    {
      kind: "resend_link" as const,
      disabled:
        !admin.selectedAppointmentId ||
        !permissions.canResendAccessLink ||
        admin.resendAccessLinkMutation.isPending,
      pending: admin.resendAccessLinkMutation.isPending,
      title: !permissions.canResendAccessLink
        ? copy.footer.resendLinkDisabled
        : undefined,
      onClick: () => {
        if (!admin.selectedAppointmentId) return;
        if (!admin.beforeResendAccessLink()) return;
        const confirmation = getAdminConfirmationCopy(lang, "resendAccessLink");
        requestConfirmation({
          title: confirmation.title,
          description: confirmation.description,
          confirmLabel: confirmation.continueLabel,
          cancelLabel: confirmation.cancelLabel,
          onConfirm: () =>
            admin.resendAccessLinkMutation.mutateAsync({
              appointmentId: admin.selectedAppointmentId!,
            }),
        });
      },
    },
    {
      kind: "reinitiate_payment" as const,
      disabled:
        !admin.selectedAppointmentId ||
        !permissions.canReinitiatePayment ||
        admin.resendPaymentMutation.isPending,
      pending: admin.resendPaymentMutation.isPending,
      title: !permissions.canReinitiatePayment
        ? copy.footer.reinitiatePaymentDisabled
        : undefined,
      onClick: () => {
        if (!admin.selectedAppointmentId) return;
        if (!admin.beforeReinitiatePayment()) return;
        const confirmation = getAdminConfirmationCopy(
          lang,
          "reinitiatePayment"
        );
        requestConfirmation({
          title: confirmation.title,
          description: confirmation.description,
          confirmLabel: confirmation.continueLabel,
          cancelLabel: confirmation.cancelLabel,
          tone: "danger",
          onConfirm: () =>
            admin.resendPaymentMutation.mutateAsync({
              appointmentId: admin.selectedAppointmentId!,
            }),
        });
      },
    },
  ];

  return (
    <BookingWorkspace
      lang={lang}
      locale={locale}
      filters={{
        emailQuery: admin.emailQuery,
        appointmentIdInput: admin.appointmentIdInput,
        statusFilter: admin.statusFilter,
        paymentStatusFilter: admin.paymentStatusFilter,
        doctorIdInput: admin.doctorIdInput,
        amountMinInput: admin.amountMinInput,
        amountMaxInput: admin.amountMaxInput,
        createdAtFrom: admin.createdAtFrom,
        createdAtTo: admin.createdAtTo,
        scheduledAtFrom: admin.scheduledAtFrom,
        scheduledAtTo: admin.scheduledAtTo,
        hasRiskFilter: admin.hasRiskFilter,
        sortBy: admin.sortBy,
        sortDirection: admin.sortDirection,
        pageSize: admin.pageSize,
        page: admin.page,
      }}
      options={{
        appointmentStatusOptions: admin.appointmentStatusOptions,
        paymentStatusOptions: admin.paymentStatusOptions,
      }}
      callbacks={{
        onEmailQueryChange: admin.setEmailQuery,
        onAppointmentIdInputChange: admin.setAppointmentIdInput,
        onOpenAppointmentById: admin.openAppointmentById,
        onStatusFilterChange: admin.setStatusFilter,
        onPaymentStatusFilterChange: admin.setPaymentStatusFilter,
        onDoctorIdInputChange: admin.setDoctorIdInput,
        onAmountMinChange: admin.setAmountMinInput,
        onAmountMaxChange: admin.setAmountMaxInput,
        onCreatedAtFromChange: admin.setCreatedAtFrom,
        onCreatedAtToChange: admin.setCreatedAtTo,
        onScheduledAtFromChange: admin.setScheduledAtFrom,
        onScheduledAtToChange: admin.setScheduledAtTo,
        onHasRiskFilterChange: admin.setHasRiskFilter,
        onSortByChange: admin.setSortBy,
        onSortDirectionChange: admin.setSortDirection,
        onPageSizeChange: admin.setPageSize,
        onPageChange: admin.setPage,
        onResetFilters: admin.resetAppointmentFilters,
        onRefresh: () => void admin.refreshAdminData(),
        onSelectAppointment: id => {
          admin.setSelectedAppointmentId(id);
          admin.setIssuedLinks(null);
        },
        onCloseDetail: () => {
          admin.setSelectedAppointmentId(null);
          admin.setIssuedLinks(null);
        },
        onToggleSelection: admin.toggleAppointmentSelection,
        onToggleAllVisible: admin.toggleSelectAllVisible,
        onClearSelection: admin.clearSelection,
        onBatchAction: input => {
          const key =
            input.action === "reinitiate_payment"
              ? "reinitiatePayment"
              : input.action === "resend_access_link"
                ? "resendAccessLink"
                : "batchUpdateAppointments";
          const confirmation = getAdminConfirmationCopy(lang, key);
          requestConfirmation({
            title: confirmation.title,
            description: confirmation.description,
            confirmLabel: confirmation.continueLabel,
            cancelLabel: confirmation.cancelLabel,
            tone: input.action === "resend_access_link" ? "default" : "danger",
            onConfirm: () =>
              admin.batchAppointmentsMutation.executeBatch(input),
          });
        },
      }}
      items={bookingItems}
      activeAppointmentId={admin.selectedAppointmentId}
      selectedAppointmentIds={admin.selectedAppointmentIds}
      isAllVisibleSelected={admin.isAllVisibleSelected}
      isAnyVisibleSelected={admin.isAnyVisibleSelected}
      isListLoading={admin.appointmentsQuery.isLoading}
      listErrorMessage={admin.appointmentsQuery.error?.message}
      total={admin.appointmentsQuery.data?.total ?? 0}
      totalPages={admin.appointmentsQuery.data?.totalPages ?? 1}
      riskSummary={admin.appointmentsQuery.data?.riskSummary ?? null}
      batchIsPending={admin.batchAppointmentsMutation.isPending}
      batchResult={admin.batchAppointmentsMutation.lastResult}
      canBatchResendAccessLink={permissions.canResendAccessLink}
      canBatchReinitiatePayment={permissions.canReinitiatePayment}
      canBatchUpdateStatus={permissions.canMutateAppointments}
      detailMeta={detailMeta}
      isDetailLoading={admin.appointmentDetailQuery.isLoading}
      detailErrorMessage={admin.appointmentDetailQuery.error?.message}
      detailContent={detailContent}
      stickyActions={stickyActions}
    />
  );
}
