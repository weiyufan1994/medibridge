import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import {
  REFERRAL_ORDER_STATUS_VALUES,
  REFERRAL_REFUND_REASON_CODE_VALUES,
  type ReferralOrderStatus,
} from "@shared/referrals";
import {
  formatReferralWaitingDuration,
  getReferralAdminStatusTone,
  getReferralAdminTaskKind,
  shouldShowReferralWaitDuration,
} from "@/features/admin/referralAdminPresentation";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import { getAdminConfirmationCopy } from "@/features/admin/copy";

type ReferralAdminPanelProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
  requestedOrderId?: number | null;
};

const MANUAL_REFERRAL_STATUS_VALUES = REFERRAL_ORDER_STATUS_VALUES.filter(
  status =>
    ![
      "paid_pending_assignment",
      "time_coordination",
      "scheduled",
      "refund_pending_review",
      "refund_processing",
      "refunded",
    ].includes(status)
);

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
  requestedOrderId,
}: ReferralAdminPanelProps) {
  const { requestConfirmation } = useAdminActionConfirmation();
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
  const [selectedStatus, setSelectedStatus] =
    useState<ReferralOrderStatus>("assigned");
  const [statusReason, setStatusReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [patientProgressUpdate, setPatientProgressUpdate] = useState("");
  const [contactOutcome, setContactOutcome] = useState<
    "connected" | "no_response" | "failed"
  >("connected");
  const [contactNote, setContactNote] = useState("");
  const [bookingOutcome, setBookingOutcome] = useState<
    "progressing" | "failed" | "scheduled"
  >("progressing");
  const [bookingNote, setBookingNote] = useState("");
  const [consultationTimeInput, setConsultationTimeInput] = useState("");
  const [consultationTimeZone, setConsultationTimeZone] =
    useState("Asia/Shanghai");
  const [consultationProviderName, setConsultationProviderName] = useState("");
  const [consultationPlatform, setConsultationPlatform] = useState("");
  const [consultationJoinUrl, setConsultationJoinUrl] = useState("");
  const [consultationInstructions, setConsultationInstructions] = useState("");
  const [consultationNote, setConsultationNote] = useState("");
  const [refundReasonCode, setRefundReasonCode] =
    useState<(typeof REFERRAL_REFUND_REASON_CODE_VALUES)[number]>(
      "contact_failed"
    );
  const [refundReasonDetail, setRefundReasonDetail] = useState("");
  const [refundReviewNote, setRefundReviewNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [detailTab, setDetailTab] = useState<
    "operations" | "patient" | "refund" | "timeline"
  >("operations");
  const [usesReferralDrawer, setUsesReferralDrawer] = useState(false);

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
    if (requestedOrderId) {
      setSelectedOrderId(requestedOrderId);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const updateLayoutMode = () => setUsesReferralDrawer(mediaQuery.matches);
    updateLayoutMode();
    mediaQuery.addEventListener("change", updateLayoutMode);
    return () => mediaQuery.removeEventListener("change", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!usesReferralDrawer || !selectedOrderId) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrderId(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrderId, usesReferralDrawer]);

  useEffect(() => {
    const items = ordersQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    if (!selectedOrderId) {
      return;
    }

    const isSelectedVisible = items.some(item => item.id === selectedOrderId);

    if (
      requestedOrderId &&
      selectedOrderId === requestedOrderId &&
      !isSelectedVisible
    ) {
      return;
    }

    if (!isSelectedVisible) {
      setSelectedOrderId(null);
    }
  }, [ordersQuery.data?.items, requestedOrderId, selectedOrderId]);

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setSelectedStatus(
      detailQuery.data.order.status === "scheduled"
        ? "completed"
        : MANUAL_REFERRAL_STATUS_VALUES.includes(detailQuery.data.order.status)
          ? detailQuery.data.order.status
          : "cancelled"
    );
    setConsultationTimeInput(
      toLocalDateTimeInputValue(detailQuery.data.order.consultationTime)
    );
    setConsultationTimeZone(
      detailQuery.data.consultationArrangement?.timeZone ?? "Asia/Shanghai"
    );
    setConsultationProviderName(
      detailQuery.data.consultationArrangement?.providerName ?? ""
    );
    setConsultationPlatform(
      detailQuery.data.consultationArrangement?.platform ?? ""
    );
    setConsultationJoinUrl(
      detailQuery.data.consultationArrangement?.joinUrl ?? ""
    );
    setConsultationInstructions(
      detailQuery.data.consultationArrangement?.instructions ?? ""
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

  useEffect(() => {
    setDetailTab("operations");
  }, [selectedOrderId]);

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
    toast.error(error instanceof Error ? error.message : copy.admin.loadFailed);
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
  const assignOrderContactMutation =
    trpc.referrals.assignOrderContact.useMutation({
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
  const publishPatientProgressMutation =
    trpc.referrals.publishPatientProgressUpdate.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        setPatientProgressUpdate("");
        await refreshReferralAdminData();
      },
      onError: handleMutationError,
    });
  const contactAttemptMutation =
    trpc.referrals.recordContactAttempt.useMutation({
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
  const beginTimeCoordinationMutation =
    trpc.referrals.beginTimeCoordination.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshReferralAdminData();
      },
      onError: handleMutationError,
    });
  const consultationTimeMutation =
    trpc.referrals.setConsultationTime.useMutation({
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
  const taskKind = orderState
    ? getReferralAdminTaskKind(orderState.status)
    : null;
  const selectedAssignee = useMemo(() => {
    if (!orderState?.assignedAgentId) {
      return copy.admin.unassigned;
    }

    const matchedUser = assignableAgentsQuery.data?.find(
      user => user.id === orderState.assignedAgentId
    );

    return (
      matchedUser?.email ||
      matchedUser?.name ||
      String(orderState.assignedAgentId)
    );
  }, [
    assignableAgentsQuery.data,
    copy.admin.unassigned,
    orderState?.assignedAgentId,
  ]);
  const selectedHospitalName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.hospital.name }).trim() ||
      copy.common.notAvailable);
  const selectedDepartmentName =
    selectedOrder &&
    (getLocalizedText({ lang, value: selectedOrder.department.name }).trim() ||
      copy.common.notAvailable);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-2xl border border-admin-border bg-admin-surface px-3 py-3">
        <div className="grid gap-2 xl:grid-cols-[1fr_180px_180px_auto]">
          <FieldShell label={copy.admin.statusFilter}>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          </FieldShell>

          <FieldShell label={copy.admin.sortDirection}>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={sortDirection}
              onChange={event => {
                setSortDirection(event.target.value as "asc" | "desc");
                setPage(1);
              }}
            >
              <option value="desc">{copy.admin.sortNewest}</option>
              <option value="asc">{copy.admin.sortOldest}</option>
            </select>
          </FieldShell>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {copy.admin.assignedToMe}
            </span>
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-input px-2 text-sm">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={event => {
                  setAssignedToMe(event.target.checked);
                  setPage(1);
                }}
              />
              {copy.admin.assignedToMe}
            </span>
          </label>

          <div className="flex items-end justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refreshReferralAdminData();
              }}
            >
              {copy.admin.refresh}
            </Button>
          </div>
        </div>

        <p className="mt-2 text-xs leading-tight text-muted-foreground">
          {copy.admin.listSummary}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-admin-border bg-admin-surface xl:grid-cols-[minmax(320px,35%)_minmax(0,65%)]">
        <div className="flex min-h-0 flex-col border-r border-admin-border">
          <div className="border-b border-admin-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {copy.admin.orderListTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {copy.admin.filtersTitle}
                </p>
              </div>
              {ordersQuery.isLoading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {ordersQuery.isLoading ? (
              <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                {copy.common.loading}
              </div>
            ) : ordersQuery.error ? (
              <div className="flex h-full items-center justify-center px-4 text-sm text-rose-600">
                {ordersQuery.error.message}
              </div>
            ) : ordersQuery.data && ordersQuery.data.items.length > 0 ? (
              <div className="divide-y divide-admin-border">
                {ordersQuery.data.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedOrderId(item.id)}
                    className={[
                      "w-full px-3 py-2 text-left text-sm leading-tight transition-colors",
                      selectedOrderId === item.id
                        ? "bg-admin-surface-muted"
                        : "hover:bg-admin-surface-muted",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-foreground">
                            #{item.id} ·{" "}
                            {getLocalizedText({
                              lang,
                              value: item.hospitalName,
                            }).trim() || copy.common.notAvailable}
                          </span>
                          {item.manualFulfillmentRequired ? (
                            <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {getLocalizedText({
                            lang,
                            value: item.departmentName,
                          }).trim() || copy.common.notAvailable}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.patientEmail ?? copy.common.notAvailable}
                        </p>
                      </div>
                      <AdminStatusBadge
                        label={getReferralStatusLabel(item.status, lang)}
                        tone={getReferralAdminStatusTone(item.status)}
                      />
                    </div>

                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
                      {shouldShowReferralWaitDuration(item.status) ? (
                        <p>
                          {copy.admin.urgencyMinutes.replace(
                            "{{duration}}",
                            formatReferralWaitingDuration(
                              item.urgencyMinutes,
                              lang
                            )
                          )}
                        </p>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <p>{formatReferralDateTime(item.updatedAt, lang)}</p>
                      <p>
                        {copy.orderDetail.consultationTime}:{" "}
                        {formatReferralDateTime(item.consultationTime, lang)}
                      </p>
                      <p>
                        {item.assignedAgentId
                          ? String(item.assignedAgentId)
                          : copy.admin.unassigned}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                {copy.admin.noOrders}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-admin-border px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {ordersQuery.data?.page ?? page} /{" "}
                {ordersQuery.data?.totalPages ?? 1}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(ordersQuery.data?.page ?? page) <= 1}
                  onClick={() => setPage(value => Math.max(1, value - 1))}
                >
                  {copy.admin.prevPage}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    (ordersQuery.data?.page ?? page) >=
                    (ordersQuery.data?.totalPages ?? 1)
                  }
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
          </div>
        </div>

        {usesReferralDrawer && selectedOrderId ? (
          <button
            type="button"
            className="fixed inset-0 top-16 z-30 bg-black/20 xl:hidden"
            aria-label={copy.common.cancel}
            onClick={() => setSelectedOrderId(null)}
          />
        ) : null}

        <div
          role={usesReferralDrawer && selectedOrderId ? "dialog" : undefined}
          aria-modal={usesReferralDrawer && selectedOrderId ? true : undefined}
          aria-labelledby={
            usesReferralDrawer && selectedOrderId
              ? "referral-order-detail-title"
              : undefined
          }
          className={cn(
            "min-h-0 overflow-hidden bg-admin-surface",
            "max-xl:fixed max-xl:inset-y-16 max-xl:right-0 max-xl:z-40 max-xl:w-[min(92vw,760px)] max-xl:border-l max-xl:border-admin-border max-xl:shadow-2xl",
            !selectedOrderId && "max-xl:hidden"
          )}
        >
          {!selectedOrderId ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
              {copy.admin.noSelection}
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 px-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.common.loading}
            </div>
          ) : detailQuery.error || !selectedOrder || !orderState ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-rose-600">
              {detailQuery.error?.message || copy.admin.loadFailed}
            </div>
          ) : (
            <Tabs
              value={detailTab}
              onValueChange={value =>
                setDetailTab(
                  value as "operations" | "patient" | "refund" | "timeline"
                )
              }
              className="flex h-full min-h-0 flex-col gap-0"
            >
              <div className="shrink-0 border-b border-admin-border bg-admin-surface">
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          id="referral-order-detail-title"
                          className="text-sm font-semibold text-foreground"
                        >
                          #{orderState.id}
                        </h3>
                        <AdminStatusBadge
                          label={getReferralStatusLabel(
                            orderState.status,
                            lang
                          )}
                          tone={getReferralAdminStatusTone(orderState.status)}
                        />
                        {orderState.manualFulfillmentRequired ? (
                          <Badge className="border border-amber-200 bg-amber-50 px-2 py-0 text-[11px] text-amber-800">
                            {copy.admin.manualFulfillmentBadge}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-foreground">
                        {selectedOrder.patient.email ??
                          copy.common.notAvailable}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="xl:hidden"
                      aria-label={copy.common.cancel}
                      autoFocus={usesReferralDrawer}
                      onClick={() => setSelectedOrderId(null)}
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
                        value={
                          selectedOrder.contact?.name ??
                          copy.admin.contactPending
                        }
                      />
                      <SummaryPill
                        label={copy.admin.paymentStatus}
                        value={orderState.paymentStatus}
                      />
                      <SummaryPill
                        label={copy.orderDetail.selectedHospital}
                        value={selectedHospitalName || copy.common.notAvailable}
                      />
                      <SummaryPill
                        label={copy.selection.recommendedDepartment}
                        value={
                          selectedDepartmentName || copy.common.notAvailable
                        }
                      />
                      <SummaryPill
                        label={copy.orderDetail.consultationTime}
                        value={formatReferralDateTime(
                          orderState.consultationTime,
                          lang
                        )}
                      />
                    </div>
                  </div>

                  {orderState.manualFulfillmentRequired ||
                  !selectedOrder.hospital.id ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-tight text-amber-900">
                      {orderState.manualFulfillmentRequired
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
                    <TabsTrigger
                      value="patient"
                      className="rounded-md px-2 py-1 text-sm"
                    >
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

              <TabsContent
                value="operations"
                className="min-h-0 overflow-y-auto p-4"
              >
                {taskKind ? (
                  <section className="mb-4 rounded-xl border border-admin-border-strong bg-admin-accent px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-accent-foreground">
                      {copy.admin.nextStep}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-admin-foreground">
                      {copy.admin.taskDescriptions[taskKind]}
                    </p>
                    {taskKind === "refund_review" ? (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => setDetailTab("refund")}
                      >
                        {copy.admin.refundTitle}
                      </Button>
                    ) : null}
                    {orderState.paymentStatus === "paid" &&
                    taskKind !== "refund_review" &&
                    taskKind !== "refund_processing" &&
                    taskKind !== "terminal" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setDetailTab("refund")}
                      >
                        {copy.admin.moreActions}
                      </Button>
                    ) : null}
                  </section>
                ) : null}
                <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {taskKind === "assign" ? (
                    <SectionBox title={copy.admin.claimOrder}>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={
                            claimOrderMutation.isPending ||
                            !currentUserId ||
                            (orderState.assignedAgentId !== null &&
                              orderState.assignedAgentId !== currentUserId)
                          }
                          onClick={() => {
                            void claimOrderMutation.mutateAsync({
                              orderId: orderState.id,
                            });
                          }}
                        >
                          {copy.admin.claimOrder}
                        </Button>
                        <select
                          className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
                          value={assigneeId}
                          onChange={event => setAssigneeId(event.target.value)}
                        >
                          <option value="">
                            {copy.admin.assignPlaceholder}
                          </option>
                          {(assignableAgentsQuery.data ?? []).map(user => (
                            <option key={user.id} value={String(user.id)}>
                              {user.email || user.name || user.id}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            assignOrderMutation.isPending ||
                            Number(assigneeId) <= 0
                          }
                          onClick={() => {
                            void assignOrderMutation.mutateAsync({
                              orderId: orderState.id,
                              assigneeId: Number(assigneeId),
                            });
                          }}
                        >
                          {copy.admin.assignOrder}
                        </Button>
                      </div>
                    </SectionBox>
                  ) : null}

                  {taskKind === "assign" ? (
                    <SectionBox title={copy.admin.assignContactTitle}>
                      {!selectedOrder.hospital.id ? (
                        <p className="text-sm text-muted-foreground">
                          {copy.admin.noLocalHospitalMapping}
                        </p>
                      ) : contactsQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">
                          {copy.common.loading}
                        </p>
                      ) : contactsQuery.error ? (
                        <p className="text-sm text-rose-600">
                          {contactsQuery.error.message}
                        </p>
                      ) : contactsQuery.data &&
                        contactsQuery.data.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={selectedContactId}
                            onChange={event =>
                              setSelectedContactId(event.target.value)
                            }
                          >
                            <option value="">
                              {copy.admin.assignContactPlaceholder}
                            </option>
                            {contactsQuery.data.map(contact => (
                              <option
                                key={contact.id}
                                value={String(contact.id)}
                              >
                                {contact.name} · {contact.roleType}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              assignOrderContactMutation.isPending ||
                              Number(selectedContactId) <= 0
                            }
                            onClick={() => {
                              void assignOrderContactMutation.mutateAsync({
                                orderId: orderState.id,
                                contactId: Number(selectedContactId),
                              });
                            }}
                          >
                            {copy.admin.assignContact}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {copy.admin.noContactsForHospital}
                        </p>
                      )}
                    </SectionBox>
                  ) : null}

                  {taskKind !== "terminal" &&
                  taskKind !== "refund_processing" &&
                  taskKind !== "refund_review" ? (
                    <SectionBox
                      title={copy.admin.updateStatus}
                      collapsible={taskKind !== "complete"}
                    >
                      <div className="space-y-2">
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={selectedStatus}
                          onChange={event =>
                            setSelectedStatus(
                              event.target.value as ReferralOrderStatus
                            )
                          }
                        >
                          {MANUAL_REFERRAL_STATUS_VALUES.map(status => (
                            <option key={status} value={status}>
                              {getReferralStatusLabel(status, lang)}
                            </option>
                          ))}
                        </select>
                        <Input
                          className="h-8"
                          value={statusReason}
                          onChange={event =>
                            setStatusReason(event.target.value)
                          }
                          placeholder={copy.admin.reason}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            updateStatusMutation.isPending ||
                            statusReason.trim().length < 3
                          }
                          onClick={() => {
                            const confirmation = getAdminConfirmationCopy(
                              lang,
                              "updateReferralStatus"
                            );
                            requestConfirmation({
                              title: confirmation.title,
                              description: confirmation.description,
                              confirmLabel: confirmation.confirmLabel,
                              cancelLabel: confirmation.cancelLabel,
                              tone:
                                selectedStatus === "cancelled"
                                  ? "danger"
                                  : "default",
                              onConfirm: () =>
                                updateStatusMutation.mutateAsync({
                                  orderId: orderState.id,
                                  toStatus: selectedStatus,
                                  reason: statusReason.trim(),
                                }),
                            });
                          }}
                        >
                          {copy.admin.updateStatus}
                        </Button>
                      </div>
                    </SectionBox>
                  ) : null}

                  {taskKind === "coordinate_time" ||
                  taskKind === "schedule" ||
                  taskKind === "complete" ? (
                    <SectionBox title={copy.admin.consultationTimeTitle}>
                      <div className="space-y-2">
                        {taskKind === "coordinate_time" ? (
                          <>
                            <Textarea
                              value={consultationNote}
                              onChange={event =>
                                setConsultationNote(event.target.value)
                              }
                              placeholder={copy.admin.consultationTimeNote}
                              className="min-h-24 px-2 py-1 text-sm leading-tight"
                            />
                            <Button
                              size="sm"
                              disabled={
                                beginTimeCoordinationMutation.isPending ||
                                consultationNote.trim().length < 1
                              }
                              onClick={() => {
                                void beginTimeCoordinationMutation.mutateAsync({
                                  orderId: orderState.id,
                                  note: consultationNote.trim(),
                                });
                              }}
                            >
                              {copy.admin.beginTimeCoordination}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Input
                              className="h-8"
                              type="datetime-local"
                              value={consultationTimeInput}
                              onChange={event =>
                                setConsultationTimeInput(event.target.value)
                              }
                            />
                            <Input
                              className="h-8"
                              value={consultationTimeZone}
                              onChange={event =>
                                setConsultationTimeZone(event.target.value)
                              }
                              placeholder={copy.admin.consultationTimeZone}
                            />
                            <Input
                              className="h-8"
                              value={consultationProviderName}
                              onChange={event =>
                                setConsultationProviderName(event.target.value)
                              }
                              placeholder={copy.admin.consultationProviderName}
                            />
                            <Input
                              className="h-8"
                              value={consultationPlatform}
                              onChange={event =>
                                setConsultationPlatform(event.target.value)
                              }
                              placeholder={copy.admin.consultationPlatform}
                            />
                            <Input
                              className="h-8"
                              type="url"
                              value={consultationJoinUrl}
                              onChange={event =>
                                setConsultationJoinUrl(event.target.value)
                              }
                              placeholder={copy.admin.consultationJoinUrl}
                            />
                            <Textarea
                              value={consultationInstructions}
                              onChange={event =>
                                setConsultationInstructions(event.target.value)
                              }
                              placeholder={copy.admin.consultationInstructions}
                              className="min-h-24 px-2 py-1 text-sm leading-tight"
                            />
                            <Textarea
                              value={consultationNote}
                              onChange={event =>
                                setConsultationNote(event.target.value)
                              }
                              placeholder={copy.admin.consultationTimeNote}
                              className="min-h-24 px-2 py-1 text-sm leading-tight"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                consultationTimeMutation.isPending ||
                                (orderState.status !== "time_coordination" &&
                                  orderState.status !== "scheduled") ||
                                consultationTimeInput.trim().length < 1 ||
                                consultationTimeZone.trim().length < 1 ||
                                consultationProviderName.trim().length < 1 ||
                                consultationPlatform.trim().length < 1 ||
                                !consultationJoinUrl
                                  .trim()
                                  .startsWith("https://") ||
                                consultationInstructions.trim().length < 1
                              }
                              onClick={() => {
                                void consultationTimeMutation.mutateAsync({
                                  orderId: orderState.id,
                                  consultationTime: new Date(
                                    consultationTimeInput
                                  ),
                                  timeZone: consultationTimeZone.trim(),
                                  providerName: consultationProviderName.trim(),
                                  platform: consultationPlatform.trim(),
                                  joinUrl: consultationJoinUrl.trim(),
                                  instructions: consultationInstructions.trim(),
                                  note: consultationNote.trim() || undefined,
                                });
                              }}
                            >
                              {copy.admin.consultationTimeTitle}
                            </Button>
                          </>
                        )}
                      </div>
                    </SectionBox>
                  ) : null}

                  {taskKind !== "terminal" ? (
                    <SectionBox title={copy.admin.addNote} collapsible>
                      <div className="space-y-2">
                        <Textarea
                          value={internalNote}
                          onChange={event =>
                            setInternalNote(event.target.value)
                          }
                          placeholder={copy.admin.note}
                          className="min-h-24 px-2 py-1 text-sm leading-tight"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            addNoteMutation.isPending ||
                            internalNote.trim().length < 1
                          }
                          onClick={() => {
                            void addNoteMutation.mutateAsync({
                              orderId: orderState.id,
                              note: internalNote.trim(),
                            });
                          }}
                        >
                          {copy.admin.addNote}
                        </Button>
                      </div>
                    </SectionBox>
                  ) : null}

                  {taskKind !== "terminal" ? (
                    <SectionBox
                      title={copy.admin.patientProgressTitle}
                      collapsible
                    >
                      <div className="space-y-2">
                        <Textarea
                          value={patientProgressUpdate}
                          onChange={event =>
                            setPatientProgressUpdate(event.target.value)
                          }
                          placeholder={copy.admin.patientProgressPlaceholder}
                          className="min-h-24 px-2 py-1 text-sm leading-tight"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            publishPatientProgressMutation.isPending ||
                            patientProgressUpdate.trim().length < 1
                          }
                          onClick={() => {
                            void publishPatientProgressMutation.mutateAsync({
                              orderId: orderState.id,
                              detail: patientProgressUpdate.trim(),
                            });
                          }}
                        >
                          {copy.admin.publishPatientProgress}
                        </Button>
                      </div>
                    </SectionBox>
                  ) : null}

                  {taskKind === "contact" ? (
                    <SectionBox title={copy.admin.contactAttemptTitle}>
                      <div className="space-y-2">
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={contactOutcome}
                          onChange={event =>
                            setContactOutcome(
                              event.target.value as
                                | "connected"
                                | "no_response"
                                | "failed"
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
                          className="min-h-24 px-2 py-1 text-sm leading-tight"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            contactAttemptMutation.isPending ||
                            contactNote.trim().length < 1
                          }
                          onClick={() => {
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
                    </SectionBox>
                  ) : null}

                  {taskKind === "booking" ? (
                    <SectionBox title={copy.admin.bookingResultTitle}>
                      <div className="space-y-2">
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={bookingOutcome}
                          onChange={event =>
                            setBookingOutcome(
                              event.target.value as
                                | "progressing"
                                | "failed"
                                | "scheduled"
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
                          className="min-h-24 px-2 py-1 text-sm leading-tight"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            bookingResultMutation.isPending ||
                            bookingNote.trim().length < 1
                          }
                          onClick={() => {
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
                    </SectionBox>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent
                value="patient"
                className="min-h-0 overflow-y-auto p-4"
              >
                <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
                  <SectionBox title={copy.admin.triageSummary}>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {copy.admin.patient}:{" "}
                        </span>
                        {selectedOrder.patient.email ??
                          copy.common.notAvailable}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {copy.orderDetail.selectedHospital}:{" "}
                        </span>
                        {selectedHospitalName}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {copy.selection.recommendedDepartment}:{" "}
                        </span>
                        {selectedDepartmentName}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {copy.orderDetail.serviceFee}:{" "}
                        </span>
                        {formatReferralMoney({
                          amount: orderState.totalAmount ?? 0,
                          currency: orderState.currency ?? "usd",
                          lang,
                        })}
                      </p>
                    </div>
                    <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm leading-6 text-foreground">
                      {selectedOrder.triageSummary || copy.common.notAvailable}
                    </div>
                  </SectionBox>

                  <SectionBox title={copy.admin.recommendationReason}>
                    <div className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm leading-6 text-foreground">
                      {selectedOrder.recommendationReason ||
                        copy.common.notAvailable}
                    </div>
                    <div className="mt-3 rounded-lg border border-dashed border-admin-border px-3 py-6 text-center text-sm text-muted-foreground">
                      {copy.admin.detailTabs.patient}
                    </div>
                  </SectionBox>
                </div>
              </TabsContent>

              <TabsContent
                value="refund"
                className="min-h-0 overflow-y-auto p-4"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mb-3"
                  onClick={() => setDetailTab("operations")}
                >
                  {copy.admin.detailTabs.operations}
                </Button>
                <div className="grid gap-3 xl:grid-cols-2">
                  <SectionBox title={copy.admin.initiateRefund}>
                    <div className="space-y-2">
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={refundReasonCode}
                        onChange={event =>
                          setRefundReasonCode(
                            event.target
                              .value as (typeof REFERRAL_REFUND_REASON_CODE_VALUES)[number]
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
                        onChange={event =>
                          setRefundReasonDetail(event.target.value)
                        }
                        placeholder={copy.admin.refundReasonDetail}
                        className="min-h-28 px-2 py-1 text-sm leading-tight"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          initiateRefundMutation.isPending ||
                          refundReasonDetail.trim().length < 1 ||
                          orderState.paymentStatus !== "paid"
                        }
                        onClick={() => {
                          const confirmation = getAdminConfirmationCopy(
                            lang,
                            "initiateReferralRefund"
                          );
                          requestConfirmation({
                            title: confirmation.title,
                            description: confirmation.description,
                            confirmLabel: confirmation.confirmLabel,
                            cancelLabel: confirmation.cancelLabel,
                            tone: "danger",
                            onConfirm: () =>
                              initiateRefundMutation.mutateAsync({
                                orderId: orderState.id,
                                reasonCode: refundReasonCode,
                                reasonDetail: refundReasonDetail.trim(),
                              }),
                          });
                        }}
                      >
                        {copy.admin.initiateRefund}
                      </Button>
                    </div>
                  </SectionBox>

                  <SectionBox title={copy.admin.refundTitle}>
                    <div className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm text-muted-foreground">
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
                          orderState.refundReason ||
                          copy.common.notAvailable}
                      </p>
                    </div>
                    <Textarea
                      value={refundReviewNote}
                      onChange={event =>
                        setRefundReviewNote(event.target.value)
                      }
                      placeholder={copy.admin.refundReviewNote}
                      className="mt-3 min-h-28 px-2 py-1 text-sm leading-tight"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={
                          reviewRefundMutation.isPending ||
                          !selectedOrder.refundRequest
                        }
                        onClick={() => {
                          if (!selectedOrder.refundRequest) {
                            return;
                          }
                          const confirmation = getAdminConfirmationCopy(
                            lang,
                            "approveReferralRefund"
                          );
                          requestConfirmation({
                            title: confirmation.title,
                            description: confirmation.description,
                            confirmLabel: confirmation.confirmLabel,
                            cancelLabel: confirmation.cancelLabel,
                            tone: "danger",
                            onConfirm: () =>
                              reviewRefundMutation.mutateAsync({
                                orderId: orderState.id,
                                refundRequestId:
                                  selectedOrder.refundRequest!.id,
                                approve: true,
                                note: refundReviewNote.trim() || undefined,
                              }),
                          });
                        }}
                      >
                        {copy.admin.approveRefund}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          reviewRefundMutation.isPending ||
                          !selectedOrder.refundRequest
                        }
                        onClick={() => {
                          if (!selectedOrder.refundRequest) {
                            return;
                          }
                          const confirmation = getAdminConfirmationCopy(
                            lang,
                            "rejectReferralRefund"
                          );
                          requestConfirmation({
                            title: confirmation.title,
                            description: confirmation.description,
                            confirmLabel: confirmation.confirmLabel,
                            cancelLabel: confirmation.cancelLabel,
                            tone: "danger",
                            onConfirm: () =>
                              reviewRefundMutation.mutateAsync({
                                orderId: orderState.id,
                                refundRequestId:
                                  selectedOrder.refundRequest!.id,
                                approve: false,
                                note: refundReviewNote.trim() || undefined,
                              }),
                          });
                        }}
                      >
                        {copy.admin.rejectRefund}
                      </Button>
                    </div>
                  </SectionBox>
                </div>
              </TabsContent>

              <TabsContent
                value="timeline"
                className="min-h-0 overflow-y-auto p-4"
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  <SectionBox title={copy.admin.timeline}>
                    <div className="space-y-2">
                      {selectedOrder.timeline.map(event => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                              {getReferralStatusLabel(event.toStatus, lang)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatReferralDateTime(event.createdAt, lang)}
                            </span>
                          </div>
                          {event.reason ? (
                            <p className="mt-1 text-xs leading-tight text-muted-foreground">
                              {event.reason}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </SectionBox>

                  <SectionBox title={copy.admin.operations}>
                    <div className="space-y-2">
                      {selectedOrder.operations.map(operation => (
                        <div
                          key={operation.id}
                          className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                              {operation.actionType}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatReferralDateTime(
                                operation.createdAt,
                                lang
                              )}
                            </span>
                          </div>
                          {operation.actionPayload ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-tight text-muted-foreground">
                              {coercePayloadToString(operation.actionPayload)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </SectionBox>

                  <SectionBox title={copy.admin.notificationFailures}>
                    {selectedOrder.notificationFailures.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {copy.admin.noNotificationFailures}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedOrder.notificationFailures.map(failure => (
                          <div
                            key={failure.id}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-rose-900">
                              {failure.eventType} · {failure.recipientType}
                            </p>
                            <p className="mt-1 text-xs text-rose-800">
                              {failure.recipient} · {failure.attemptCount}
                            </p>
                            {failure.lastError ? (
                              <p className="mt-1 text-xs leading-tight text-rose-700">
                                {failure.lastError}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionBox>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionBox({
  title,
  children,
  collapsible = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="rounded-xl border border-admin-border bg-admin-surface">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-admin-foreground">
          {title}
        </summary>
        <div className="border-t border-admin-border px-3 py-3">{children}</div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-admin-border bg-admin-surface px-3 py-3">
      <div className="mb-2 text-sm font-semibold text-admin-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-admin-border bg-admin-surface-muted px-2 py-1">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-xs font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}
