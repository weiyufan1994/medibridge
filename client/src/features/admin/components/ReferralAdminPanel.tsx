import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getReferralCopy } from "@/features/referrals";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type {
  ReferralOrderStatus,
  ReferralRefundReasonCode,
} from "@shared/referrals";
import {
  getReferralAdminManualStatusTargets,
  getReferralAdminPrimaryNextStatus,
} from "@/features/admin/adminStatusTransitions";
import {
  areReferralConsultationDraftsEqual,
  clearReferralConsultationDraft,
  getReferralConsultationDraftIssues,
  readReferralConsultationDraft,
  saveReferralConsultationDraft,
  type ReferralConsultationDraft,
} from "@/features/admin/referralConsultationDraft";
import {
  clearReferralStatusDraft,
  isReferralStatusDraftCompatible,
  readReferralStatusDraft,
  saveReferralStatusDraft,
} from "@/features/admin/referralStatusDraft";
import { getReferralAdminTaskKind } from "@/features/admin/referralAdminPresentation";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import { getAdminConfirmationCopy } from "@/features/admin/copy";
import { ReferralAdminFilters } from "./referral-admin/ReferralAdminFilters";
import { ReferralAssignmentSections } from "./referral-admin/ReferralAssignmentSections";
import { ReferralCommunicationSections } from "./referral-admin/ReferralCommunicationSections";
import { ReferralConsultationSection } from "./referral-admin/ReferralConsultationSection";
import { ReferralOrderDetailHeader } from "./referral-admin/ReferralOrderDetailHeader";
import { ReferralOrderList } from "./referral-admin/ReferralOrderList";
import { ReferralPatientSection } from "./referral-admin/ReferralPatientSection";
import { ReferralRefundSection } from "./referral-admin/ReferralRefundSection";
import { ReferralStatusSection } from "./referral-admin/ReferralStatusSection";
import { ReferralTimelineSection } from "./referral-admin/ReferralTimelineSection";
import { ReferralWorkflowGuidance } from "./referral-admin/ReferralWorkflowGuidance";

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
    useState<ReferralRefundReasonCode>("contact_failed");
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
  const manualStatusTargets = orderState
    ? getReferralAdminManualStatusTargets(orderState.status)
    : [];
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
                  <ReferralWorkflowGuidance
                    lang={lang}
                    status={orderState.status}
                    taskKind={taskKind}
                    primaryNextStatus={primaryNextStatus}
                    paymentStatus={orderState.paymentStatus}
                    onOpenRefund={() => setDetailTab("refund")}
                  />
                ) : null}
                <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                  <ReferralAssignmentSections
                    lang={lang}
                    taskKind={taskKind}
                    currentUserId={currentUserId}
                    assignedAgentId={orderState.assignedAgentId}
                    assigneeId={assigneeId}
                    agents={assignableAgentsQuery.data ?? []}
                    selectedContactId={selectedContactId}
                    hasLocalHospitalMapping={Boolean(selectedOrder.hospital.id)}
                    contactsLoading={contactsQuery.isLoading}
                    contactsHaveError={Boolean(contactsQuery.error)}
                    contactsErrorMessage={contactsQuery.error?.message}
                    contacts={contactsQuery.data ?? []}
                    claimPending={claimOrderMutation.isPending}
                    assignPending={assignOrderMutation.isPending}
                    assignContactPending={assignOrderContactMutation.isPending}
                    onAssigneeIdChange={setAssigneeId}
                    onSelectedContactIdChange={setSelectedContactId}
                    onClaim={() => {
                      void claimOrderMutation.mutateAsync({
                        orderId: orderState.id,
                      });
                    }}
                    onAssign={() => {
                      void assignOrderMutation.mutateAsync({
                        orderId: orderState.id,
                        assigneeId: Number(assigneeId),
                      });
                    }}
                    onAssignContact={() => {
                      void assignOrderContactMutation.mutateAsync({
                        orderId: orderState.id,
                        contactId: Number(selectedContactId),
                      });
                    }}
                  />

                  <ReferralStatusSection
                    lang={lang}
                    manualStatusTargets={manualStatusTargets}
                    isScheduledCompletion={isScheduledCompletion}
                    selectedStatus={selectedStatus}
                    statusReason={statusReason}
                    statusDraftIsDirty={statusDraftIsDirty}
                    updatePending={updateStatusMutation.isPending}
                    onSelectedStatusChange={setSelectedStatus}
                    onStatusReasonChange={setStatusReason}
                    onSubmit={() => {
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
                          selectedStatus === "cancelled" ? "danger" : "default",
                        onConfirm: () =>
                          updateStatusMutation.mutateAsync({
                            orderId: orderState.id,
                            toStatus: selectedStatus,
                            reason: statusReason.trim(),
                          }),
                      });
                    }}
                  />

                  <ReferralConsultationSection
                    lang={lang}
                    orderId={orderState.id}
                    orderStatus={orderState.status}
                    taskKind={taskKind}
                    consultationTimeInput={consultationTimeInput}
                    consultationTimeZone={consultationTimeZone}
                    consultationProviderName={consultationProviderName}
                    consultationPlatform={consultationPlatform}
                    consultationJoinUrl={consultationJoinUrl}
                    consultationInstructions={consultationInstructions}
                    consultationNote={consultationNote}
                    consultationDraftIssues={consultationDraftIssues}
                    consultationDraftIsDirty={consultationDraftIsDirty}
                    beginCoordinationPending={
                      beginTimeCoordinationMutation.isPending
                    }
                    saveConsultationPending={consultationTimeMutation.isPending}
                    onConsultationTimeInputChange={setConsultationTimeInput}
                    onConsultationTimeZoneChange={setConsultationTimeZone}
                    onConsultationProviderNameChange={
                      setConsultationProviderName
                    }
                    onConsultationPlatformChange={setConsultationPlatform}
                    onConsultationJoinUrlChange={setConsultationJoinUrl}
                    onConsultationInstructionsChange={
                      setConsultationInstructions
                    }
                    onConsultationNoteChange={setConsultationNote}
                    onBeginCoordination={() => {
                      void beginTimeCoordinationMutation.mutateAsync({
                        orderId: orderState.id,
                        note: consultationNote.trim(),
                      });
                    }}
                    onSaveConsultation={() => {
                      void consultationTimeMutation.mutateAsync({
                        orderId: orderState.id,
                        consultationTime: new Date(consultationTimeInput),
                        timeZone: consultationTimeZone.trim(),
                        providerName: consultationProviderName.trim(),
                        platform: consultationPlatform.trim(),
                        joinUrl: consultationJoinUrl.trim(),
                        instructions: consultationInstructions.trim(),
                        note: consultationNote.trim() || undefined,
                      });
                    }}
                  />

                  <ReferralCommunicationSections
                    lang={lang}
                    taskKind={taskKind}
                    internalNote={internalNote}
                    patientProgressUpdate={patientProgressUpdate}
                    contactOutcome={contactOutcome}
                    contactNote={contactNote}
                    bookingOutcome={bookingOutcome}
                    bookingNote={bookingNote}
                    addNotePending={addNoteMutation.isPending}
                    publishProgressPending={
                      publishPatientProgressMutation.isPending
                    }
                    contactAttemptPending={contactAttemptMutation.isPending}
                    bookingResultPending={bookingResultMutation.isPending}
                    onInternalNoteChange={setInternalNote}
                    onPatientProgressChange={setPatientProgressUpdate}
                    onContactOutcomeChange={setContactOutcome}
                    onContactNoteChange={setContactNote}
                    onBookingOutcomeChange={setBookingOutcome}
                    onBookingNoteChange={setBookingNote}
                    onAddNote={() => {
                      void addNoteMutation.mutateAsync({
                        orderId: orderState.id,
                        note: internalNote.trim(),
                      });
                    }}
                    onPublishProgress={() => {
                      void publishPatientProgressMutation.mutateAsync({
                        orderId: orderState.id,
                        detail: patientProgressUpdate.trim(),
                      });
                    }}
                    onRecordContactAttempt={() => {
                      void contactAttemptMutation.mutateAsync({
                        orderId: orderState.id,
                        outcome: contactOutcome,
                        note: contactNote.trim(),
                      });
                    }}
                    onRecordBookingResult={() => {
                      void bookingResultMutation.mutateAsync({
                        orderId: orderState.id,
                        outcome: bookingOutcome,
                        note: bookingNote.trim(),
                      });
                    }}
                  />
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

              <ReferralRefundSection
                lang={lang}
                paymentStatus={orderState.paymentStatus}
                orderRefundReason={orderState.refundReason}
                refundRequest={selectedOrder.refundRequest}
                refundReasonCode={refundReasonCode}
                refundReasonDetail={refundReasonDetail}
                refundReviewNote={refundReviewNote}
                initiatePending={initiateRefundMutation.isPending}
                reviewPending={reviewRefundMutation.isPending}
                onBack={() => setDetailTab("operations")}
                onRefundReasonCodeChange={setRefundReasonCode}
                onRefundReasonDetailChange={setRefundReasonDetail}
                onRefundReviewNoteChange={setRefundReviewNote}
                onInitiateRefund={() => {
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
                onReviewRefund={approve => {
                  if (!selectedOrder.refundRequest) {
                    return;
                  }
                  const confirmation = getAdminConfirmationCopy(
                    lang,
                    approve ? "approveReferralRefund" : "rejectReferralRefund"
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
                        refundRequestId: selectedOrder.refundRequest!.id,
                        approve,
                        note: refundReviewNote.trim() || undefined,
                      }),
                  });
                }}
              />

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
