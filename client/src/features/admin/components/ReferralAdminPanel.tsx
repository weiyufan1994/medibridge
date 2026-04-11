import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { getReferralCopy } from "@/features/referrals/copy";
import {
  formatReferralDateTime,
  formatReferralMoney,
  getReferralStatusLabel,
  getRefundStatusLabel,
} from "@/features/referrals/presentation";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  REFERRAL_ORDER_STATUS_VALUES,
  REFERRAL_REFUND_REASON_CODE_VALUES,
  type ReferralOrderStatus,
} from "@shared/referrals";

type ReferralAdminPanelProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
};

function toLocalDateTimeInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function coercePayloadToString(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function ReferralAdminPanel({
  currentUserId,
  currentUserRole,
}: ReferralAdminPanelProps) {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<ReferralOrderStatus | "all">(
    "all"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReferralOrderStatus>(
    "assigned"
  );
  const [statusReason, setStatusReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [contactOutcome, setContactOutcome] = useState<
    "connected" | "no_response" | "failed"
  >("connected");
  const [contactNote, setContactNote] = useState("");
  const [bookingOutcome, setBookingOutcome] = useState<
    "progressing" | "failed" | "scheduled"
  >("progressing");
  const [bookingNote, setBookingNote] = useState("");
  const [consultationTimeInput, setConsultationTimeInput] = useState("");
  const [consultationNote, setConsultationNote] = useState("");
  const [refundReasonCode, setRefundReasonCode] = useState<
    (typeof REFERRAL_REFUND_REASON_CODE_VALUES)[number]
  >("contact_failed");
  const [refundReasonDetail, setRefundReasonDetail] = useState("");
  const [refundReviewNote, setRefundReviewNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

  const ordersQuery = trpc.referrals.listOrders.useQuery({
    page,
    pageSize: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    assignedToMe,
    sortDirection,
  });

  const assignableAgentsQuery = trpc.referrals.listAssignableAgents.useQuery();

  const detailQuery = trpc.referrals.getAdminOrderDetail.useQuery(
    { orderId: selectedOrderId ?? 0 },
    {
      enabled: selectedOrderId !== null,
    }
  );
  const contactsQuery = trpc.referrals.listContactsForAdmin.useQuery(
    {
      hospitalId: detailQuery.data?.hospital.id ?? 0,
    },
    {
      enabled: Boolean(detailQuery.data?.hospital.id),
    }
  );

  useEffect(() => {
    const items = ordersQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    const isSelectedVisible = selectedOrderId
      ? items.some(item => item.id === selectedOrderId)
      : false;

    if (!isSelectedVisible) {
      setSelectedOrderId(items[0]?.id ?? null);
    }
  }, [ordersQuery.data?.items, selectedOrderId]);

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setSelectedStatus(detailQuery.data.order.status);
    setConsultationTimeInput(
      toLocalDateTimeInputValue(detailQuery.data.order.consultationTime)
    );
    setAssigneeId(
      detailQuery.data.order.assignedAgentId
        ? String(detailQuery.data.order.assignedAgentId)
        : ""
    );
    setSelectedContactId(
      detailQuery.data.contact ? String(detailQuery.data.contact.id) : ""
    );
  }, [detailQuery.data]);

  async function refreshReferralAdminData() {
    await Promise.all([
      utils.referrals.listOrders.invalidate(),
      selectedOrderId
        ? utils.referrals.getAdminOrderDetail.invalidate({
            orderId: selectedOrderId,
          })
        : Promise.resolve(),
      detailQuery.data?.hospital.id
        ? utils.referrals.listContactsForAdmin.invalidate({
            hospitalId: detailQuery.data.hospital.id,
          })
        : Promise.resolve(),
    ]);
  }

  function handleMutationError(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : copy.admin.loadFailed
    );
  }

  const claimOrderMutation = trpc.referrals.claimOrder.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const assignOrderMutation = trpc.referrals.assignOrder.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const assignOrderContactMutation = trpc.referrals.assignOrderContact.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const updateStatusMutation = trpc.referrals.updateOrderStatus.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setStatusReason("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const addNoteMutation = trpc.referrals.addInternalNote.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setInternalNote("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const contactAttemptMutation = trpc.referrals.recordContactAttempt.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setContactNote("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const bookingResultMutation = trpc.referrals.recordBookingResult.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setBookingNote("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const consultationTimeMutation = trpc.referrals.setConsultationTime.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setConsultationNote("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const initiateRefundMutation = trpc.referrals.initiateRefund.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setRefundReasonDetail("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });
  const reviewRefundMutation = trpc.referrals.reviewRefund.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setRefundReviewNote("");
      await refreshReferralAdminData();
    },
    onError: handleMutationError,
  });

  const selectedOrder = detailQuery.data;
  const orderState = selectedOrder?.order ?? null;
  const selectedAssignee = useMemo(() => {
    if (!orderState?.assignedAgentId) {
      return copy.admin.unassigned;
    }

    const matchedUser = assignableAgentsQuery.data?.find(
      user => user.id === orderState.assignedAgentId
    );

    return matchedUser?.email || matchedUser?.name || String(orderState.assignedAgentId);
  }, [assignableAgentsQuery.data, copy.admin.unassigned, orderState?.assignedAgentId]);
  const selectedHospitalName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.hospital.name }).trim() ||
      copy.common.notAvailable);
  const selectedDepartmentName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.department.name }).trim() ||
      copy.common.notAvailable);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <CardTitle>{copy.admin.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.admin.description}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {copy.admin.statusFilter}
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={event => {
                setStatusFilter(
                  event.target.value === "all"
                    ? "all"
                    : (event.target.value as ReferralOrderStatus)
                );
                setPage(1);
              }}
            >
              <option value="all">{copy.admin.statusAll}</option>
              {REFERRAL_ORDER_STATUS_VALUES.map(status => (
                <option key={status} value={status}>
                  {getReferralStatusLabel(status, lang)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {copy.admin.sortDirection}
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sortDirection}
              onChange={event => {
                setSortDirection(event.target.value as "asc" | "desc");
                setPage(1);
              }}
            >
              <option value="desc">{copy.admin.sortNewest}</option>
              <option value="asc">{copy.admin.sortOldest}</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={event => {
                  setAssignedToMe(event.target.checked);
                  setPage(1);
                }}
              />
              {copy.admin.assignedToMe}
            </label>
          </div>

          <div className="flex items-end justify-end">
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() => {
                void refreshReferralAdminData();
              }}
            >
              {copy.admin.refresh}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-3xl border-slate-200/80">
          <CardHeader>
            <CardTitle>{copy.admin.orderListTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.common.loading}
              </div>
            ) : ordersQuery.error ? (
              <p className="text-sm text-rose-600">{ordersQuery.error.message}</p>
            ) : ordersQuery.data && ordersQuery.data.items.length > 0 ? (
              <>
                <div className="space-y-3">
                  {ordersQuery.data.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedOrderId(item.id)}
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition-colors",
                        selectedOrderId === item.id
                          ? "border-teal-500 bg-teal-50/70"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            #{item.id} ·{" "}
                            {getLocalizedText({ lang, value: item.hospitalName }).trim() ||
                              copy.common.notAvailable}
                          </p>
                          <p className="text-sm text-slate-500">
                            {getLocalizedText({ lang, value: item.departmentName }).trim() ||
                              copy.common.notAvailable}
                          </p>
                          <p className="text-sm text-slate-500">
                            {(item.contactName ?? copy.admin.contactPending)} ·{" "}
                            {item.patientEmail ?? copy.common.notAvailable}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.manualFulfillmentRequired ? (
                            <Badge className="border-0 bg-amber-100 text-amber-900">
                              {copy.admin.manualFulfillmentBadge}
                            </Badge>
                          ) : null}
                          <Badge className="border-0 bg-teal-600 text-white">
                            {getReferralStatusLabel(item.status, lang)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        <p>
                          {copy.admin.urgencyMinutes.replace(
                            "{{minutes}}",
                            String(item.urgencyMinutes)
                          )}
                        </p>
                        <p>{formatReferralDateTime(item.updatedAt, lang)}</p>
                        <p>
                          {copy.orderDetail.consultationTime}:{" "}
                          {formatReferralDateTime(item.consultationTime, lang)}
                        </p>
                        <p>
                          {orderState?.assignedAgentId === item.assignedAgentId &&
                          item.assignedAgentId
                            ? selectedAssignee
                            : item.assignedAgentId || copy.admin.unassigned}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <p>
                    {ordersQuery.data.page} / {ordersQuery.data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={ordersQuery.data.page <= 1}
                      onClick={() => setPage(value => Math.max(1, value - 1))}
                    >
                      {copy.admin.prevPage}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={ordersQuery.data.page >= ordersQuery.data.totalPages}
                      onClick={() =>
                        setPage(value =>
                          Math.min(ordersQuery.data?.totalPages ?? value, value + 1)
                        )
                      }
                    >
                      {copy.admin.nextPage}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{copy.admin.noOrders}</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/80">
          <CardHeader>
            <CardTitle>{copy.admin.orderDetailTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedOrderId ? (
              <p className="text-sm text-slate-500">{copy.admin.noSelection}</p>
            ) : detailQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.common.loading}
              </div>
            ) : detailQuery.error || !selectedOrder ? (
              <p className="text-sm text-rose-600">
                {detailQuery.error?.message || copy.admin.loadFailed}
              </p>
            ) : (
              <>
                {orderState?.manualFulfillmentRequired ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-amber-100 text-amber-900">
                        {copy.admin.manualFulfillmentBadge}
                      </Badge>
                      <span>{copy.admin.manualFulfillmentDetail}</span>
                    </div>
                  </div>
                ) : null}

                {!selectedOrder.hospital.id ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {copy.admin.noLocalHospitalMapping}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">
                        #{orderState?.id}
                      </p>
                      <Badge className="border-0 bg-teal-600 text-white">
                        {orderState
                          ? getReferralStatusLabel(orderState.status, lang)
                          : copy.common.notAvailable}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>
                        {copy.admin.patient}:{" "}
                        {selectedOrder.patient.email ?? copy.common.notAvailable}
                      </p>
                      <p>
                        {copy.orderDetail.selectedHospital}:{" "}
                        {selectedHospitalName}
                      </p>
                      <p>
                        {copy.selection.recommendedDepartment}: {selectedDepartmentName}
                      </p>
                      <p>
                        {copy.orderDetail.selectedContact}:{" "}
                        {selectedOrder.contact?.name ?? copy.admin.contactPending}
                      </p>
                      <p>
                        {copy.orderDetail.consultationTime}:{" "}
                        {formatReferralDateTime(
                          orderState?.consultationTime,
                          lang
                        )}
                      </p>
                      <p>
                        {copy.orderDetail.serviceFee}:{" "}
                        {formatReferralMoney({
                          amount: orderState?.totalAmount ?? 0,
                          currency: orderState?.currency ?? "usd",
                          lang,
                        })}
                      </p>
                      <p>
                        {copy.orderDetail.assignedAgent}: {selectedAssignee}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.triageSummary}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedOrder.triageSummary || copy.common.notAvailable}
                    </p>
                    {selectedOrder.recommendationReason ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {copy.admin.recommendationReason}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {selectedOrder.recommendationReason}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.claimOrder}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                        disabled={
                          claimOrderMutation.isPending ||
                          !currentUserId ||
                          (orderState?.assignedAgentId !== null &&
                            orderState?.assignedAgentId !== currentUserId)
                        }
                        onClick={() => {
                          if (!orderState) {
                            return;
                          }
                          void claimOrderMutation.mutateAsync({
                            orderId: orderState.id,
                          });
                        }}
                      >
                        {copy.admin.claimOrder}
                      </Button>
                      <>
                        <select
                          className="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
                          value={assigneeId}
                          onChange={event => setAssigneeId(event.target.value)}
                        >
                          <option value="">{copy.admin.assignPlaceholder}</option>
                          {(assignableAgentsQuery.data ?? []).map(user => (
                            <option key={user.id} value={String(user.id)}>
                              {user.email || user.name || user.id}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          className="rounded-xl border-slate-200"
                          disabled={
                            assignOrderMutation.isPending ||
                            Number(assigneeId) <= 0
                          }
                          onClick={() => {
                            if (!orderState) {
                              return;
                            }
                            void assignOrderMutation.mutateAsync({
                              orderId: orderState.id,
                              assigneeId: Number(assigneeId),
                            });
                          }}
                        >
                          {copy.admin.assignOrder}
                        </Button>
                      </>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.assignContactTitle}
                    </p>
                    {!selectedOrder.hospital.id ? (
                      <p className="text-sm leading-6 text-slate-500">
                        {copy.admin.noLocalHospitalMapping}
                      </p>
                    ) : contactsQuery.isLoading ? (
                      <p className="text-sm text-slate-500">{copy.common.loading}</p>
                    ) : contactsQuery.error ? (
                      <p className="text-sm text-rose-600">{contactsQuery.error.message}</p>
                    ) : contactsQuery.data && contactsQuery.data.length > 0 ? (
                      <>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={selectedContactId}
                          onChange={event => setSelectedContactId(event.target.value)}
                        >
                          <option value="">
                            {copy.admin.assignContactPlaceholder}
                          </option>
                          {contactsQuery.data.map(contact => (
                            <option key={contact.id} value={String(contact.id)}>
                              {contact.name} · {contact.roleType}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          className="rounded-xl border-slate-200"
                          disabled={
                            assignOrderContactMutation.isPending ||
                            Number(selectedContactId) <= 0
                          }
                          onClick={() => {
                            if (!orderState) {
                              return;
                            }
                            void assignOrderContactMutation.mutateAsync({
                              orderId: orderState.id,
                              contactId: Number(selectedContactId),
                            });
                          }}
                        >
                          {copy.admin.assignContact}
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">
                        {copy.admin.noContactsForHospital}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.updateStatus}
                    </p>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedStatus}
                      onChange={event =>
                        setSelectedStatus(event.target.value as ReferralOrderStatus)
                      }
                    >
                      {REFERRAL_ORDER_STATUS_VALUES.map(status => (
                        <option key={status} value={status}>
                          {getReferralStatusLabel(status, lang)}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={statusReason}
                      onChange={event => setStatusReason(event.target.value)}
                      placeholder={copy.admin.reason}
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={updateStatusMutation.isPending || statusReason.trim().length < 3}
                      onClick={() => {
                        if (!orderState) {
                          return;
                        }
                        void updateStatusMutation.mutateAsync({
                          orderId: orderState.id,
                          toStatus: selectedStatus,
                          reason: statusReason.trim(),
                        });
                      }}
                    >
                      {copy.admin.updateStatus}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.addNote}
                    </p>
                    <Textarea
                      value={internalNote}
                      onChange={event => setInternalNote(event.target.value)}
                      placeholder={copy.admin.note}
                      className="min-h-[108px]"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={addNoteMutation.isPending || internalNote.trim().length < 1}
                      onClick={() => {
                        if (!orderState) {
                          return;
                        }
                        void addNoteMutation.mutateAsync({
                          orderId: orderState.id,
                          note: internalNote.trim(),
                        });
                      }}
                    >
                      {copy.admin.addNote}
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.contactAttemptTitle}
                    </p>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={contactOutcome}
                      onChange={event =>
                        setContactOutcome(
                          event.target.value as "connected" | "no_response" | "failed"
                        )
                      }
                    >
                      {Object.entries(copy.admin.contactOutcomes).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                    <Textarea
                      value={contactNote}
                      onChange={event => setContactNote(event.target.value)}
                      placeholder={copy.admin.note}
                      className="min-h-[108px]"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={
                        contactAttemptMutation.isPending || contactNote.trim().length < 1
                      }
                      onClick={() => {
                        if (!orderState) {
                          return;
                        }
                        void contactAttemptMutation.mutateAsync({
                          orderId: orderState.id,
                          outcome: contactOutcome,
                          note: contactNote.trim(),
                        });
                      }}
                    >
                      {copy.admin.contactAttemptTitle}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.bookingResultTitle}
                    </p>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={bookingOutcome}
                      onChange={event =>
                        setBookingOutcome(
                          event.target.value as "progressing" | "failed" | "scheduled"
                        )
                      }
                    >
                      {Object.entries(copy.admin.bookingOutcomes).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                    <Textarea
                      value={bookingNote}
                      onChange={event => setBookingNote(event.target.value)}
                      placeholder={copy.admin.note}
                      className="min-h-[108px]"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={
                        bookingResultMutation.isPending || bookingNote.trim().length < 1
                      }
                      onClick={() => {
                        if (!orderState) {
                          return;
                        }
                        void bookingResultMutation.mutateAsync({
                          orderId: orderState.id,
                          outcome: bookingOutcome,
                          note: bookingNote.trim(),
                        });
                      }}
                    >
                      {copy.admin.bookingResultTitle}
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.consultationTimeTitle}
                    </p>
                    <Input
                      type="datetime-local"
                      value={consultationTimeInput}
                      onChange={event => setConsultationTimeInput(event.target.value)}
                    />
                    <Textarea
                      value={consultationNote}
                      onChange={event => setConsultationNote(event.target.value)}
                      placeholder={copy.admin.consultationTimeNote}
                      className="min-h-[108px]"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200"
                      disabled={
                        consultationTimeMutation.isPending ||
                        consultationTimeInput.trim().length < 1
                      }
                      onClick={() => {
                        if (!orderState) {
                          return;
                        }
                        void consultationTimeMutation.mutateAsync({
                          orderId: orderState.id,
                          consultationTime: new Date(consultationTimeInput),
                          note: consultationNote.trim() || undefined,
                        });
                      }}
                    >
                      {copy.admin.consultationTimeTitle}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {copy.admin.refundTitle}
                  </p>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={refundReasonCode}
                        onChange={event =>
                          setRefundReasonCode(
                            event.target.value as (typeof REFERRAL_REFUND_REASON_CODE_VALUES)[number]
                          )
                        }
                      >
                        {REFERRAL_REFUND_REASON_CODE_VALUES.map(reasonCode => (
                          <option key={reasonCode} value={reasonCode}>
                            {copy.admin.refundReasonCodes[reasonCode]}
                          </option>
                        ))}
                      </select>
                      <Textarea
                        value={refundReasonDetail}
                        onChange={event => setRefundReasonDetail(event.target.value)}
                        placeholder={copy.admin.refundReasonDetail}
                        className="min-h-[108px]"
                      />
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200"
                        disabled={
                          initiateRefundMutation.isPending ||
                          refundReasonDetail.trim().length < 1 ||
                          orderState?.paymentStatus !== "paid"
                        }
                        onClick={() => {
                          if (!orderState) {
                            return;
                          }
                          void initiateRefundMutation.mutateAsync({
                            orderId: orderState.id,
                            reasonCode: refundReasonCode,
                            reasonDetail: refundReasonDetail.trim(),
                          });
                        }}
                      >
                        {copy.admin.initiateRefund}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <p>
                          {copy.orderDetail.refundStatus}:{" "}
                          {selectedOrder.refundRequest
                            ? getRefundStatusLabel(
                                selectedOrder.refundRequest.status,
                                lang
                              )
                            : copy.common.notAvailable}
                        </p>
                        <p className="mt-2">
                          {copy.admin.reason}:{" "}
                          {selectedOrder.refundRequest?.reasonDetail ||
                            orderState?.refundReason ||
                            copy.common.notAvailable}
                        </p>
                      </div>
                      <Textarea
                        value={refundReviewNote}
                        onChange={event => setRefundReviewNote(event.target.value)}
                        placeholder={copy.admin.refundReviewNote}
                        className="min-h-[108px]"
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                          disabled={
                            reviewRefundMutation.isPending ||
                            !selectedOrder.refundRequest
                          }
                          onClick={() => {
                            if (!selectedOrder.refundRequest) {
                              return;
                            }
                            if (!orderState) {
                              return;
                            }
                            void reviewRefundMutation.mutateAsync({
                              orderId: orderState.id,
                              refundRequestId: selectedOrder.refundRequest.id,
                              approve: true,
                              note: refundReviewNote.trim() || undefined,
                            });
                          }}
                        >
                          {copy.admin.approveRefund}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl border-slate-200"
                          disabled={
                            reviewRefundMutation.isPending ||
                            !selectedOrder.refundRequest
                          }
                          onClick={() => {
                            if (!selectedOrder.refundRequest) {
                              return;
                            }
                            if (!orderState) {
                              return;
                            }
                            void reviewRefundMutation.mutateAsync({
                              orderId: orderState.id,
                              refundRequestId: selectedOrder.refundRequest.id,
                              approve: false,
                              note: refundReviewNote.trim() || undefined,
                            });
                          }}
                        >
                          {copy.admin.rejectRefund}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.timeline}
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.timeline.map(event => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-slate-900">
                              {getReferralStatusLabel(event.toStatus, lang)}
                            </span>
                            <span className="text-slate-500">
                              {formatReferralDateTime(event.createdAt, lang)}
                            </span>
                          </div>
                          {event.reason ? (
                            <p className="mt-2 text-slate-600">{event.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {copy.admin.operations}
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.operations.map(operation => (
                        <div
                          key={operation.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-slate-900">
                              {operation.actionType}
                            </span>
                            <span className="text-slate-500">
                              {formatReferralDateTime(operation.createdAt, lang)}
                            </span>
                          </div>
                          {operation.actionPayload ? (
                            <p className="mt-2 whitespace-pre-wrap text-slate-600">
                              {coercePayloadToString(operation.actionPayload)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
