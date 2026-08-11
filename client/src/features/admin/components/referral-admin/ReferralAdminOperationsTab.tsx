import { TabsContent } from "@/components/ui/tabs";
import { useAdminActionConfirmation } from "../../adminActionConfirmationContext";
import { getReferralAdminPrimaryNextStatus } from "../../adminStatusTransitions";
import { getAdminConfirmationCopy } from "../../copy";
import { getReferralAdminTaskKind } from "../../referralAdminPresentation";
import type { useReferralAdminActions } from "../../hooks/useReferralAdminActions";
import type { useReferralAdminDrafts } from "../../hooks/useReferralAdminDrafts";
import type { useReferralAdminSelection } from "../../hooks/useReferralAdminSelection";
import { ReferralAssignmentSections } from "./ReferralAssignmentSections";
import { ReferralCommunicationSections } from "./ReferralCommunicationSections";
import { ReferralConsultationSection } from "./ReferralConsultationSection";
import { ReferralStatusSection } from "./ReferralStatusSection";
import { ReferralWorkflowGuidance } from "./ReferralWorkflowGuidance";

type SelectionController = ReturnType<typeof useReferralAdminSelection>;
type DraftController = ReturnType<typeof useReferralAdminDrafts>;
type ActionController = ReturnType<typeof useReferralAdminActions>;
type SelectedOrder = NonNullable<SelectionController["detailQuery"]["data"]>;

type ReferralAdminOperationsTabProps = {
  lang: "en" | "zh";
  currentUserId: number | null;
  selectedOrder: SelectedOrder;
  selection: SelectionController;
  drafts: DraftController;
  actions: ActionController;
};

export function ReferralAdminOperationsTab({
  lang,
  currentUserId,
  selectedOrder,
  selection,
  drafts,
  actions,
}: ReferralAdminOperationsTabProps) {
  const { requestConfirmation } = useAdminActionConfirmation();
  const orderState = selectedOrder.order;
  const taskKind = getReferralAdminTaskKind(orderState.status);
  const primaryNextStatus = getReferralAdminPrimaryNextStatus(
    orderState.status
  );

  return (
    <TabsContent value="operations" className="min-h-0 overflow-y-auto p-4">
      <ReferralWorkflowGuidance
        lang={lang}
        status={orderState.status}
        taskKind={taskKind}
        primaryNextStatus={primaryNextStatus}
        paymentStatus={orderState.paymentStatus}
        onOpenRefund={() => selection.setDetailTab("refund")}
      />
      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        <ReferralAssignmentSections
          lang={lang}
          taskKind={taskKind}
          currentUserId={currentUserId}
          assignedAgentId={orderState.assignedAgentId}
          assigneeId={selection.assigneeId}
          agents={selection.assignableAgentsQuery.data ?? []}
          selectedContactId={selection.selectedContactId}
          hasLocalHospitalMapping={Boolean(selectedOrder.hospital.id)}
          contactsLoading={selection.contactsQuery.isLoading}
          contactsHaveError={Boolean(selection.contactsQuery.error)}
          contactsErrorMessage={selection.contactsQuery.error?.message}
          contacts={selection.contactsQuery.data ?? []}
          claimPending={actions.claimOrderMutation.isPending}
          assignPending={actions.assignOrderMutation.isPending}
          assignContactPending={actions.assignOrderContactMutation.isPending}
          onAssigneeIdChange={selection.setAssigneeId}
          onSelectedContactIdChange={selection.setSelectedContactId}
          onClaim={() => {
            void actions.claimOrderMutation.mutateAsync({
              orderId: orderState.id,
            });
          }}
          onAssign={() => {
            void actions.assignOrderMutation.mutateAsync({
              orderId: orderState.id,
              assigneeId: Number(selection.assigneeId),
            });
          }}
          onAssignContact={() => {
            void actions.assignOrderContactMutation.mutateAsync({
              orderId: orderState.id,
              contactId: Number(selection.selectedContactId),
            });
          }}
        />

        <ReferralStatusSection
          lang={lang}
          manualStatusTargets={drafts.manualStatusTargets}
          isScheduledCompletion={drafts.isScheduledCompletion}
          selectedStatus={drafts.selectedStatus}
          statusReason={drafts.statusReason}
          statusDraftIsDirty={drafts.statusDraftIsDirty}
          updatePending={actions.updateStatusMutation.isPending}
          onSelectedStatusChange={drafts.setSelectedStatus}
          onStatusReasonChange={drafts.setStatusReason}
          onSubmit={() => {
            const confirmation = getAdminConfirmationCopy(
              lang,
              drafts.isScheduledCompletion
                ? "completeReferralConsultation"
                : "updateReferralStatus"
            );
            requestConfirmation({
              title: confirmation.title,
              description: confirmation.description,
              confirmLabel: confirmation.confirmLabel,
              cancelLabel: confirmation.cancelLabel,
              tone:
                drafts.selectedStatus === "cancelled" ? "danger" : "default",
              onConfirm: () =>
                actions.updateStatusMutation.mutateAsync({
                  orderId: orderState.id,
                  toStatus: drafts.selectedStatus,
                  reason: drafts.statusReason.trim(),
                }),
            });
          }}
        />

        <ReferralConsultationSection
          lang={lang}
          orderId={orderState.id}
          orderStatus={orderState.status}
          taskKind={taskKind}
          consultationTimeInput={drafts.consultationTimeInput}
          consultationTimeZone={drafts.consultationTimeZone}
          consultationProviderName={drafts.consultationProviderName}
          consultationPlatform={drafts.consultationPlatform}
          consultationJoinUrl={drafts.consultationJoinUrl}
          consultationInstructions={drafts.consultationInstructions}
          consultationNote={drafts.consultationNote}
          consultationDraftIssues={drafts.consultationDraftIssues}
          consultationDraftIsDirty={drafts.consultationDraftIsDirty}
          beginCoordinationPending={
            actions.beginTimeCoordinationMutation.isPending
          }
          saveConsultationPending={actions.consultationTimeMutation.isPending}
          onConsultationTimeInputChange={drafts.setConsultationTimeInput}
          onConsultationTimeZoneChange={drafts.setConsultationTimeZone}
          onConsultationProviderNameChange={drafts.setConsultationProviderName}
          onConsultationPlatformChange={drafts.setConsultationPlatform}
          onConsultationJoinUrlChange={drafts.setConsultationJoinUrl}
          onConsultationInstructionsChange={drafts.setConsultationInstructions}
          onConsultationNoteChange={drafts.setConsultationNote}
          onBeginCoordination={() => {
            void actions.beginTimeCoordinationMutation.mutateAsync({
              orderId: orderState.id,
              note: drafts.consultationNote.trim(),
            });
          }}
          onSaveConsultation={() => {
            void actions.consultationTimeMutation.mutateAsync({
              orderId: orderState.id,
              consultationTime: new Date(drafts.consultationTimeInput),
              timeZone: drafts.consultationTimeZone.trim(),
              providerName: drafts.consultationProviderName.trim(),
              platform: drafts.consultationPlatform.trim(),
              joinUrl: drafts.consultationJoinUrl.trim(),
              instructions: drafts.consultationInstructions.trim(),
              note: drafts.consultationNote.trim() || undefined,
            });
          }}
        />

        <ReferralCommunicationSections
          lang={lang}
          taskKind={taskKind}
          internalNote={actions.internalNote}
          patientProgressUpdate={actions.patientProgressUpdate}
          contactOutcome={actions.contactOutcome}
          contactNote={actions.contactNote}
          bookingOutcome={actions.bookingOutcome}
          bookingNote={actions.bookingNote}
          addNotePending={actions.addNoteMutation.isPending}
          publishProgressPending={
            actions.publishPatientProgressMutation.isPending
          }
          contactAttemptPending={actions.contactAttemptMutation.isPending}
          bookingResultPending={actions.bookingResultMutation.isPending}
          onInternalNoteChange={actions.setInternalNote}
          onPatientProgressChange={actions.setPatientProgressUpdate}
          onContactOutcomeChange={actions.setContactOutcome}
          onContactNoteChange={actions.setContactNote}
          onBookingOutcomeChange={actions.setBookingOutcome}
          onBookingNoteChange={actions.setBookingNote}
          onAddNote={() => {
            void actions.addNoteMutation.mutateAsync({
              orderId: orderState.id,
              note: actions.internalNote.trim(),
            });
          }}
          onPublishProgress={() => {
            void actions.publishPatientProgressMutation.mutateAsync({
              orderId: orderState.id,
              detail: actions.patientProgressUpdate.trim(),
            });
          }}
          onRecordContactAttempt={() => {
            void actions.contactAttemptMutation.mutateAsync({
              orderId: orderState.id,
              outcome: actions.contactOutcome,
              note: actions.contactNote.trim(),
            });
          }}
          onRecordBookingResult={() => {
            void actions.bookingResultMutation.mutateAsync({
              orderId: orderState.id,
              outcome: actions.bookingOutcome,
              note: actions.bookingNote.trim(),
            });
          }}
        />
      </div>
    </TabsContent>
  );
}
