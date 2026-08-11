import { useEffect, useMemo, useState } from "react";
import { getReferralAdminManualStatusTargets } from "../adminStatusTransitions";
import {
  areReferralConsultationDraftsEqual,
  clearReferralConsultationDraft,
  getReferralConsultationDraftIssues,
  readReferralConsultationDraft,
  saveReferralConsultationDraft,
  type ReferralConsultationDraft,
} from "../referralConsultationDraft";
import {
  clearReferralStatusDraft,
  isReferralStatusDraftCompatible,
  readReferralStatusDraft,
  saveReferralStatusDraft,
} from "../referralStatusDraft";
import type { ReferralOrderStatus } from "@shared/referrals";

type ReferralAdminDraftDetail = {
  order: {
    id: number;
    status: ReferralOrderStatus;
    consultationTime: Date | null;
  };
  consultationArrangement: {
    timeZone: string;
    providerName: string;
    platform: string;
    joinUrl: string;
    instructions: string;
  } | null;
};

type ConsultationSavedInput = {
  orderId: number;
  consultationTime: Date | string;
  timeZone: string;
  providerName: string;
  platform: string;
  joinUrl: string;
  instructions: string;
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

export function useReferralAdminDrafts({
  selectedOrderId,
  detail,
}: {
  selectedOrderId: number | null;
  detail: ReferralAdminDraftDetail | undefined;
}) {
  const [selectedStatus, setSelectedStatus] =
    useState<ReferralOrderStatus>("assigned");
  const [statusReason, setStatusReason] = useState("");
  const [statusDraftContext, setStatusDraftContext] = useState<string | null>(
    null
  );
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

  useEffect(() => {
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
  }, [detail, selectedOrderId, statusDraftContext]);

  useEffect(() => {
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
  }, [consultationDraftOrderId, detail, selectedOrderId]);

  const orderState = detail?.order ?? null;
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

  function handleStatusSaved(orderId: number) {
    clearReferralStatusDraft(window.sessionStorage, orderId);
    setStatusReason("");
  }

  function handleConsultationSaved(input: ConsultationSavedInput) {
    const savedDraft: ReferralConsultationDraft = {
      consultationTimeInput: toLocalDateTimeInputValue(input.consultationTime),
      timeZone: input.timeZone,
      providerName: input.providerName,
      platform: input.platform,
      joinUrl: input.joinUrl,
      instructions: input.instructions,
      note: "",
    };

    clearReferralConsultationDraft(window.sessionStorage, input.orderId);
    if (consultationDraftOrderId === input.orderId) {
      setConsultationDraftBaseline(savedDraft);
    }
    setConsultationNote("");
  }

  return {
    selectedStatus,
    statusReason,
    manualStatusTargets,
    isScheduledCompletion,
    statusDraftIsDirty,
    consultationTimeInput,
    consultationTimeZone,
    consultationProviderName,
    consultationPlatform,
    consultationJoinUrl,
    consultationInstructions,
    consultationNote,
    consultationDraftIssues,
    consultationDraftIsDirty,
    setSelectedStatus,
    setStatusReason,
    setConsultationTimeInput,
    setConsultationTimeZone,
    setConsultationProviderName,
    setConsultationPlatform,
    setConsultationJoinUrl,
    setConsultationInstructions,
    setConsultationNote,
    handleStatusSaved,
    handleConsultationSaved,
  };
}
