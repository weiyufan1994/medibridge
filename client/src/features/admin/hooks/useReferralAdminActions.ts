import { useState } from "react";
import { toast } from "sonner";
import { getReferralCopy } from "@/features/referrals";
import { trpc } from "@/lib/trpc";
import type { ReferralRefundReasonCode } from "@shared/referrals";

type ConsultationSavedInput = {
  orderId: number;
  consultationTime: Date | string;
  timeZone: string;
  providerName: string;
  platform: string;
  joinUrl: string;
  instructions: string;
};

type UseReferralAdminActionsInput = {
  lang: "en" | "zh";
  selectedOrderId: number | null;
  refreshData: () => Promise<void>;
  onStatusSaved: (orderId: number) => void;
  onConsultationSaved: (input: ConsultationSavedInput) => void;
};

export function useReferralAdminActions({
  lang,
  selectedOrderId,
  refreshData,
  onStatusSaved,
  onConsultationSaved,
}: UseReferralAdminActionsInput) {
  const copy = getReferralCopy(lang);
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
  const [coordinationNotes, setCoordinationNotes] = useState<
    Partial<Record<number, string>>
  >({});
  const coordinationNote =
    selectedOrderId === null ? "" : (coordinationNotes[selectedOrderId] ?? "");
  const [refundReasonCode, setRefundReasonCode] =
    useState<ReferralRefundReasonCode>("contact_failed");
  const [refundReasonDetail, setRefundReasonDetail] = useState("");
  const [refundReviewNote, setRefundReviewNote] = useState("");

  function handleMutationError(error: unknown) {
    toast.error(error instanceof Error ? error.message : copy.admin.loadFailed);
  }

  function setCoordinationNote(note: string) {
    if (selectedOrderId === null) {
      return;
    }

    setCoordinationNotes(notes => ({ ...notes, [selectedOrderId]: note }));
  }

  const claimOrderMutation = trpc.referrals.claimOrder.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshData();
    },
    onError: handleMutationError,
  });
  const assignOrderMutation = trpc.referrals.assignOrder.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshData();
    },
    onError: handleMutationError,
  });
  const assignOrderContactMutation =
    trpc.referrals.assignOrderContact.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshData();
      },
      onError: handleMutationError,
    });
  const updateStatusMutation = trpc.referrals.updateOrderStatus.useMutation({
    onSuccess: async (_data, variables) => {
      onStatusSaved(variables.orderId);
      toast.success(copy.admin.actionSuccess);
      await refreshData();
    },
    onError: handleMutationError,
  });
  const addNoteMutation = trpc.referrals.addInternalNote.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setInternalNote("");
      await refreshData();
    },
    onError: handleMutationError,
  });
  const publishPatientProgressMutation =
    trpc.referrals.publishPatientProgressUpdate.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        setPatientProgressUpdate("");
        await refreshData();
      },
      onError: handleMutationError,
    });
  const contactAttemptMutation =
    trpc.referrals.recordContactAttempt.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        setContactNote("");
        await refreshData();
      },
      onError: handleMutationError,
    });
  const bookingResultMutation = trpc.referrals.recordBookingResult.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setBookingNote("");
      await refreshData();
    },
    onError: handleMutationError,
  });
  const beginTimeCoordinationMutation =
    trpc.referrals.beginTimeCoordination.useMutation({
      onSuccess: async (_data, input) => {
        toast.success(copy.admin.actionSuccess);
        setCoordinationNotes(notes => {
          const remainingNotes = { ...notes };
          delete remainingNotes[input.orderId];
          return remainingNotes;
        });
        await refreshData();
      },
      onError: handleMutationError,
    });
  const consultationTimeMutation =
    trpc.referrals.setConsultationTime.useMutation({
      onSuccess: async (_data, variables) => {
        onConsultationSaved(variables);
        toast.success(copy.admin.actionSuccess);
        await refreshData();
      },
      onError: handleMutationError,
    });
  const initiateRefundMutation = trpc.referrals.initiateRefund.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setRefundReasonDetail("");
      await refreshData();
    },
    onError: handleMutationError,
  });
  const reviewRefundMutation = trpc.referrals.reviewRefund.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setRefundReviewNote("");
      await refreshData();
    },
    onError: handleMutationError,
  });

  return {
    internalNote,
    patientProgressUpdate,
    contactOutcome,
    contactNote,
    bookingOutcome,
    bookingNote,
    coordinationNote,
    refundReasonCode,
    refundReasonDetail,
    refundReviewNote,
    claimOrderMutation,
    assignOrderMutation,
    assignOrderContactMutation,
    updateStatusMutation,
    addNoteMutation,
    publishPatientProgressMutation,
    contactAttemptMutation,
    bookingResultMutation,
    beginTimeCoordinationMutation,
    consultationTimeMutation,
    initiateRefundMutation,
    reviewRefundMutation,
    setInternalNote,
    setPatientProgressUpdate,
    setContactOutcome,
    setContactNote,
    setBookingOutcome,
    setBookingNote,
    setCoordinationNote,
    setRefundReasonCode,
    setRefundReasonDetail,
    setRefundReviewNote,
  };
}
