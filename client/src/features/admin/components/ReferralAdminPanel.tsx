import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getReferralCopy,
  getReferralStatusLabel,
  getRefundStatusLabel,
} from "@/features/referrals";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  REFERRAL_REFUND_REASON_CODE_VALUES,
  type ReferralOrderStatus,
} from "@shared/referrals";
import {
  getReferralAdminManualStatusTargets,
  getReferralAdminPrimaryNextStatus,
  getReferralStatusAdvanceMode,
} from "@/features/admin/adminStatusTransitions";
import {
  areReferralConsultationDraftsEqual,
  clearReferralConsultationDraft,
  getReferralConsultationDraftIssues,
  readReferralConsultationDraft,
  saveReferralConsultationDraft,
  type ReferralConsultationDraft,
  type ReferralConsultationDraftIssue,
} from "@/features/admin/referralConsultationDraft";
import {
  clearReferralStatusDraft,
  isReferralStatusDraftCompatible,
  readReferralStatusDraft,
  saveReferralStatusDraft,
} from "@/features/admin/referralStatusDraft";
import {
  getReferralAdminStatusTone,
  getReferralAdminTaskKind,
} from "@/features/admin/referralAdminPresentation";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import { AdminStatusBadge } from "@/features/admin/components/AdminStatusBadge";
import {
  getAdminConfirmationCopy,
  getAdminStatusGuidanceCopy,
} from "@/features/admin/copy";
import {
  FieldShell,
  SectionBox,
} from "./referral-admin/ReferralAdminPrimitives";
import { ReferralAdminFilters } from "./referral-admin/ReferralAdminFilters";
import { ReferralOrderDetailHeader } from "./referral-admin/ReferralOrderDetailHeader";
import { ReferralOrderList } from "./referral-admin/ReferralOrderList";
import { ReferralPatientSection } from "./referral-admin/ReferralPatientSection";
import { ReferralTimelineSection } from "./referral-admin/ReferralTimelineSection";

type ReferralAdminPanelProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
  requestedOrderId?: number | null;
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

export function ReferralAdminPanel({
  currentUserId,
  currentUserRole,
  requestedOrderId,
}: ReferralAdminPanelProps) {
  const { requestConfirmation } = useAdminActionConfirmation();
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const statusGuidanceCopy = getAdminStatusGuidanceCopy(lang);
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
  const [statusDraftContext, setStatusDraftContext] = useState<string | null>(
    null
  );
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
  const [consultationDraftOrderId, setConsultationDraftOrderId] = useState<
    number | null
  >(null);
  const [consultationDraftBaseline, setConsultationDraftBaseline] =
    useState<ReferralConsultationDraft | null>(null);
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
    const detail = detailQuery.data;
    if (!detail || detail.order.id !== selectedOrderId) {
      return;
    }

    const currentStatus = detail.order.status;
    const nextContext = `${detail.order.id}:${currentStatus}`;
    if (statusDraftContext === nextContext) {
      return;
    }

    const allowedTargets = getReferralAdminManualStatusTargets(currentStatus);
    const defaultTarget = allowedTargets[0] ?? currentStatus;
    const storedDraft = readReferralStatusDraft(
      window.sessionStorage,
      detail.order.id
    );

    if (
      storedDraft &&
      isReferralStatusDraftCompatible({
        draft: storedDraft,
        currentStatus,
        allowedTargets,
      })
    ) {
      setSelectedStatus(storedDraft.toStatus);
      setStatusReason(storedDraft.reason);
    } else {
      if (storedDraft) {
        clearReferralStatusDraft(window.sessionStorage, detail.order.id);
      }
      setSelectedStatus(defaultTarget);
      setStatusReason("");
    }
    setStatusDraftContext(nextContext);
  }, [detailQuery.data, selectedOrderId, statusDraftContext]);

  useEffect(() => {
    const detail = detailQuery.data;
    if (
      !detail ||
      detail.order.id !== selectedOrderId ||
      consultationDraftOrderId === detail.order.id
    ) {
      return;
    }

    const serverDraft: ReferralConsultationDraft = {
      consultationTimeInput: toLocalDateTimeInputValue(
        detail.order.consultationTime
      ),
      timeZone: detail.consultationArrangement?.timeZone ?? "Asia/Shanghai",
      providerName: detail.consultationArrangement?.providerName ?? "",
      platform: detail.consultationArrangement?.platform ?? "",
      joinUrl: detail.consultationArrangement?.joinUrl ?? "",
      instructions: detail.consultationArrangement?.instructions ?? "",
      note: "",
    };
    const storedDraft = readReferralConsultationDraft(
      window.sessionStorage,
      detail.order.id
    );
    const initialDraft = storedDraft ?? serverDraft;

    setConsultationTimeInput(initialDraft.consultationTimeInput);
    setConsultationTimeZone(initialDraft.timeZone);
    setConsultationProviderName(initialDraft.providerName);
    setConsultationPlatform(initialDraft.platform);
    setConsultationJoinUrl(initialDraft.joinUrl);
    setConsultationInstructions(initialDraft.instructions);
    setConsultationNote(initialDraft.note);
    setConsultationDraftBaseline(serverDraft);
    setConsultationDraftOrderId(detail.order.id);
  }, [consultationDraftOrderId, detailQuery.data, selectedOrderId]);

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
    onSuccess: async (_data, variables) => {
      clearReferralStatusDraft(window.sessionStorage, variables.orderId);
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
      onSuccess: async (_data, variables) => {
        const savedDraft: ReferralConsultationDraft = {
          consultationTimeInput: toLocalDateTimeInputValue(
            variables.consultationTime
          ),
          timeZone: variables.timeZone,
          providerName: variables.providerName,
          platform: variables.platform,
          joinUrl: variables.joinUrl,
          instructions: variables.instructions,
          note: "",
        };

        clearReferralConsultationDraft(
          window.sessionStorage,
          variables.orderId
        );
        if (consultationDraftOrderId === variables.orderId) {
          setConsultationDraftBaseline(savedDraft);
        }
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
  const primaryNextStatus = orderState
    ? getReferralAdminPrimaryNextStatus(orderState.status)
    : null;
  const advanceMode = orderState
    ? getReferralStatusAdvanceMode(orderState.status)
    : null;
  const manualStatusTargets = orderState
    ? getReferralAdminManualStatusTargets(orderState.status)
    : [];
  const statusReasonIsValid = statusReason.trim().length >= 3;
  const activeStatusDraftContext = orderState
    ? `${orderState.id}:${orderState.status}`
    : null;
  const isScheduledCompletion =
    orderState?.status === "scheduled" &&
    manualStatusTargets.includes("completed");
  const statusDraftIsDirty =
    statusDraftContext === activeStatusDraftContext &&
    statusReason.length > 0 &&
    orderState !== null &&
    manualStatusTargets.includes(selectedStatus);

  useEffect(() => {
    if (
      !orderState ||
      statusDraftContext !== activeStatusDraftContext ||
      !manualStatusTargets.includes(selectedStatus)
    ) {
      return;
    }

    if (!statusReason) {
      clearReferralStatusDraft(window.sessionStorage, orderState.id);
      return;
    }

    saveReferralStatusDraft(window.sessionStorage, orderState.id, {
      fromStatus: orderState.status,
      toStatus: selectedStatus,
      reason: statusReason,
    });
  }, [
    activeStatusDraftContext,
    manualStatusTargets,
    orderState,
    selectedStatus,
    statusDraftContext,
    statusReason,
  ]);

  const consultationDraft = useMemo<ReferralConsultationDraft>(
    () => ({
      consultationTimeInput,
      timeZone: consultationTimeZone,
      providerName: consultationProviderName,
      platform: consultationPlatform,
      joinUrl: consultationJoinUrl,
      instructions: consultationInstructions,
      note: consultationNote,
    }),
    [
      consultationInstructions,
      consultationJoinUrl,
      consultationNote,
      consultationPlatform,
      consultationProviderName,
      consultationTimeInput,
      consultationTimeZone,
    ]
  );
  const consultationDraftIssues = useMemo(
    () => getReferralConsultationDraftIssues(consultationDraft),
    [consultationDraft]
  );
  const consultationIssueMessages: Record<
    ReferralConsultationDraftIssue,
    string
  > = copy.admin.consultationValidationIssues;
  const consultationDraftIsDirty =
    consultationDraftOrderId === selectedOrderId &&
    consultationDraftBaseline !== null &&
    !areReferralConsultationDraftsEqual(
      consultationDraft,
      consultationDraftBaseline
    );

  useEffect(() => {
    if (
      consultationDraftOrderId === null ||
      consultationDraftOrderId !== selectedOrderId ||
      consultationDraftBaseline === null
    ) {
      return;
    }

    if (
      areReferralConsultationDraftsEqual(
        consultationDraft,
        consultationDraftBaseline
      )
    ) {
      clearReferralConsultationDraft(
        window.sessionStorage,
        consultationDraftOrderId
      );
      return;
    }

    saveReferralConsultationDraft(
      window.sessionStorage,
      consultationDraftOrderId,
      consultationDraft
    );
  }, [
    consultationDraft,
    consultationDraftBaseline,
    consultationDraftOrderId,
    selectedOrderId,
  ]);

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
      <ReferralAdminFilters
        lang={lang}
        statusFilter={statusFilter}
        sortDirection={sortDirection}
        assignedToMe={assignedToMe}
        onStatusFilterChange={value => {
          setStatusFilter(value);
          setPage(1);
        }}
        onSortDirectionChange={value => {
          setSortDirection(value);
          setPage(1);
        }}
        onAssignedToMeChange={value => {
          setAssignedToMe(value);
          setPage(1);
        }}
        onRefresh={() => {
          void refreshReferralAdminData();
        }}
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-admin-border bg-admin-surface xl:grid-cols-[minmax(320px,35%)_minmax(0,65%)]">
        <ReferralOrderList
          lang={lang}
          isLoading={ordersQuery.isLoading}
          hasError={Boolean(ordersQuery.error)}
          errorMessage={ordersQuery.error?.message}
          items={ordersQuery.data?.items ?? []}
          selectedOrderId={selectedOrderId}
          page={ordersQuery.data?.page ?? page}
          totalPages={ordersQuery.data?.totalPages ?? 1}
          onSelectOrder={setSelectedOrderId}
          onPreviousPage={() => setPage(value => Math.max(1, value - 1))}
          onNextPage={() =>
            setPage(value =>
              Math.min(ordersQuery.data?.totalPages ?? value, value + 1)
            )
          }
        />

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
              <ReferralOrderDetailHeader
                lang={lang}
                orderId={orderState.id}
                status={orderState.status}
                manualFulfillmentRequired={orderState.manualFulfillmentRequired}
                patientEmail={selectedOrder.patient.email}
                selectedAssignee={selectedAssignee}
                selectedContactName={selectedOrder.contact?.name ?? null}
                paymentStatus={orderState.paymentStatus}
                hospitalName={selectedHospitalName || copy.common.notAvailable}
                departmentName={
                  selectedDepartmentName || copy.common.notAvailable
                }
                consultationTime={orderState.consultationTime}
                hasLocalHospitalMapping={Boolean(selectedOrder.hospital.id)}
                usesReferralDrawer={usesReferralDrawer}
                onClose={() => setSelectedOrderId(null)}
              />

              <TabsContent
                value="operations"
                className="min-h-0 overflow-y-auto p-4"
              >
                {taskKind ? (
                  <section className="mb-4 rounded-xl border border-admin-border-strong bg-admin-accent px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-accent-foreground">
                      {statusGuidanceCopy.referral.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
                      {statusGuidanceCopy.referral.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-admin-muted-foreground">
                          {statusGuidanceCopy.referral.currentStatus}
                        </p>
                        <AdminStatusBadge
                          label={getReferralStatusLabel(
                            orderState.status,
                            lang
                          )}
                          tone={getReferralAdminStatusTone(orderState.status)}
                        />
                      </div>
                      <ArrowRight
                        aria-hidden="true"
                        className="mt-4 size-4 text-admin-accent-foreground"
                      />
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-admin-muted-foreground">
                          {statusGuidanceCopy.referral.nextStatus}
                        </p>
                        {primaryNextStatus ? (
                          <AdminStatusBadge
                            label={getReferralStatusLabel(
                              primaryNextStatus,
                              lang
                            )}
                            tone={getReferralAdminStatusTone(primaryNextStatus)}
                          />
                        ) : (
                          <span className="inline-flex min-h-6 items-center rounded-md border border-admin-border bg-admin-surface px-2 text-xs font-medium text-admin-foreground">
                            {advanceMode === "terminal"
                              ? statusGuidanceCopy.referral.noNextStatus
                              : statusGuidanceCopy.referral.noFixedTarget}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-admin-foreground">
                      {copy.admin.nextStep}:{" "}
                      {copy.admin.taskDescriptions[taskKind]}
                    </p>
                    {advanceMode ? (
                      <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
                        {statusGuidanceCopy.referral.advanceModes[advanceMode]}
                      </p>
                    ) : null}
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

                  {manualStatusTargets.length > 0 ? (
                    <SectionBox
                      title={
                        isScheduledCompletion
                          ? statusGuidanceCopy.referral.completionTitle
                          : statusGuidanceCopy.referral.manualCorrectionTitle
                      }
                      collapsible={!isScheduledCompletion}
                    >
                      <div className="space-y-2">
                        <p className="text-xs leading-5 text-muted-foreground">
                          {isScheduledCompletion
                            ? statusGuidanceCopy.referral.completionDescription
                            : statusGuidanceCopy.referral
                                .manualCorrectionDescription}
                        </p>
                        {isScheduledCompletion ? (
                          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                            {statusGuidanceCopy.referral.completionNoAutoNotice}
                          </p>
                        ) : (
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={selectedStatus}
                            onChange={event =>
                              setSelectedStatus(
                                event.target.value as ReferralOrderStatus
                              )
                            }
                          >
                            {manualStatusTargets.map(status => (
                              <option key={status} value={status}>
                                {getReferralStatusLabel(status, lang)}
                              </option>
                            ))}
                          </select>
                        )}
                        <FieldShell
                          label={
                            isScheduledCompletion
                              ? statusGuidanceCopy.referral
                                  .completionReasonLabel
                              : copy.admin.reason
                          }
                        >
                          <Textarea
                            className="min-h-20 px-2 py-1 text-sm leading-tight"
                            value={statusReason}
                            onChange={event =>
                              setStatusReason(event.target.value)
                            }
                            placeholder={
                              isScheduledCompletion
                                ? statusGuidanceCopy.referral
                                    .completionReasonLabel
                                : copy.admin.reason
                            }
                          />
                        </FieldShell>
                        {statusDraftIsDirty ? (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {statusGuidanceCopy.referral.statusDraftSaved}
                          </p>
                        ) : null}
                        <Button
                          size="sm"
                          variant={
                            isScheduledCompletion ? "default" : "outline"
                          }
                          disabled={
                            updateStatusMutation.isPending ||
                            !manualStatusTargets.includes(selectedStatus) ||
                            !statusReasonIsValid
                          }
                          onClick={() => {
                            const confirmation = getAdminConfirmationCopy(
                              lang,
                              isScheduledCompletion
                                ? "completeReferralConsultation"
                                : "updateReferralStatus"
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
                          {isScheduledCompletion
                            ? statusGuidanceCopy.referral.completionAction
                            : copy.admin.updateStatus}
                        </Button>
                        <p
                          className={cn(
                            "text-xs leading-5",
                            statusReasonIsValid
                              ? "text-muted-foreground"
                              : "text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {statusGuidanceCopy.reasonRequirement}
                        </p>
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
                            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                              {copy.admin.consultationScheduleHint}
                            </p>
                            <FieldShell
                              label={copy.admin.consultationTimeInput}
                            >
                              <Input
                                className="h-8"
                                type="datetime-local"
                                value={consultationTimeInput}
                                aria-invalid={
                                  consultationDraftIssues.includes(
                                    "consultation_time_required"
                                  ) ||
                                  consultationDraftIssues.includes(
                                    "consultation_time_invalid"
                                  )
                                }
                                onChange={event =>
                                  setConsultationTimeInput(event.target.value)
                                }
                              />
                            </FieldShell>
                            <FieldShell label={copy.admin.consultationTimeZone}>
                              <Input
                                className="h-8"
                                value={consultationTimeZone}
                                aria-invalid={consultationDraftIssues.includes(
                                  "time_zone_required"
                                )}
                                onChange={event =>
                                  setConsultationTimeZone(event.target.value)
                                }
                                placeholder={copy.admin.consultationTimeZone}
                              />
                            </FieldShell>
                            <FieldShell
                              label={copy.admin.consultationProviderName}
                            >
                              <Input
                                className="h-8"
                                value={consultationProviderName}
                                aria-invalid={consultationDraftIssues.includes(
                                  "provider_required"
                                )}
                                onChange={event =>
                                  setConsultationProviderName(
                                    event.target.value
                                  )
                                }
                                placeholder={
                                  copy.admin.consultationProviderName
                                }
                              />
                            </FieldShell>
                            <FieldShell label={copy.admin.consultationPlatform}>
                              <Input
                                className="h-8"
                                value={consultationPlatform}
                                aria-invalid={consultationDraftIssues.includes(
                                  "platform_required"
                                )}
                                onChange={event =>
                                  setConsultationPlatform(event.target.value)
                                }
                                placeholder={copy.admin.consultationPlatform}
                              />
                            </FieldShell>
                            <FieldShell label={copy.admin.consultationJoinUrl}>
                              <Input
                                className="h-8"
                                type="url"
                                value={consultationJoinUrl}
                                aria-invalid={
                                  consultationDraftIssues.includes(
                                    "join_url_required"
                                  ) ||
                                  consultationDraftIssues.includes(
                                    "join_url_https_required"
                                  )
                                }
                                onChange={event =>
                                  setConsultationJoinUrl(event.target.value)
                                }
                                placeholder={copy.admin.consultationJoinUrl}
                              />
                            </FieldShell>
                            <FieldShell
                              label={copy.admin.consultationInstructions}
                            >
                              <Textarea
                                value={consultationInstructions}
                                aria-invalid={consultationDraftIssues.includes(
                                  "instructions_required"
                                )}
                                onChange={event =>
                                  setConsultationInstructions(
                                    event.target.value
                                  )
                                }
                                placeholder={
                                  copy.admin.consultationInstructions
                                }
                                className="min-h-24 px-2 py-1 text-sm leading-tight"
                              />
                            </FieldShell>
                            <FieldShell label={copy.admin.consultationTimeNote}>
                              <Textarea
                                value={consultationNote}
                                onChange={event =>
                                  setConsultationNote(event.target.value)
                                }
                                placeholder={copy.admin.consultationTimeNote}
                                className="min-h-24 px-2 py-1 text-sm leading-tight"
                              />
                            </FieldShell>
                            {consultationDraftIssues.length > 0 ? (
                              <div
                                id={`referral-consultation-validation-${orderState.id}`}
                                role="status"
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                              >
                                <p className="font-medium">
                                  {copy.admin.consultationValidationTitle}
                                </p>
                                <ul className="mt-1 list-disc pl-4">
                                  {consultationDraftIssues.map(issue => (
                                    <li key={issue}>
                                      {consultationIssueMessages[issue]}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {consultationDraftIsDirty ? (
                              <p className="text-xs leading-5 text-muted-foreground">
                                {copy.admin.consultationDraftSaved}
                              </p>
                            ) : null}
                            <Button
                              size="sm"
                              variant={
                                orderState.status === "time_coordination"
                                  ? "default"
                                  : "outline"
                              }
                              aria-describedby={
                                consultationDraftIssues.length > 0
                                  ? `referral-consultation-validation-${orderState.id}`
                                  : undefined
                              }
                              disabled={
                                consultationTimeMutation.isPending ||
                                (orderState.status !== "time_coordination" &&
                                  orderState.status !== "scheduled") ||
                                consultationDraftIssues.length > 0
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
                              {orderState.status === "time_coordination"
                                ? copy.admin.saveAndScheduleConsultation
                                : copy.admin.saveConsultationArrangement}
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

              <ReferralPatientSection
                lang={lang}
                patientEmail={selectedOrder.patient.email}
                hospitalName={selectedHospitalName}
                departmentName={selectedDepartmentName}
                totalAmount={orderState.totalAmount}
                currency={orderState.currency}
                triageSummary={selectedOrder.triageSummary}
                recommendationReason={selectedOrder.recommendationReason}
              />

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

              <ReferralTimelineSection
                lang={lang}
                timeline={selectedOrder.timeline}
                operations={selectedOrder.operations}
                notificationFailures={selectedOrder.notificationFailures}
              />
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
