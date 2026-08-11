import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getReferralCopy } from "@/features/referrals";
import type { ReferralAdminTaskKind } from "../../referralAdminPresentation";
import { SectionBox } from "./ReferralAdminPrimitives";

type ContactOutcome = "connected" | "no_response" | "failed";
type BookingOutcome = "progressing" | "failed" | "scheduled";

type ReferralCommunicationSectionsProps = {
  lang: "en" | "zh";
  taskKind: ReferralAdminTaskKind | null;
  internalNote: string;
  patientProgressUpdate: string;
  contactOutcome: ContactOutcome;
  contactNote: string;
  bookingOutcome: BookingOutcome;
  bookingNote: string;
  addNotePending: boolean;
  publishProgressPending: boolean;
  contactAttemptPending: boolean;
  bookingResultPending: boolean;
  onInternalNoteChange: (value: string) => void;
  onPatientProgressChange: (value: string) => void;
  onContactOutcomeChange: (value: ContactOutcome) => void;
  onContactNoteChange: (value: string) => void;
  onBookingOutcomeChange: (value: BookingOutcome) => void;
  onBookingNoteChange: (value: string) => void;
  onAddNote: () => void;
  onPublishProgress: () => void;
  onRecordContactAttempt: () => void;
  onRecordBookingResult: () => void;
};

export function ReferralCommunicationSections({
  lang,
  taskKind,
  internalNote,
  patientProgressUpdate,
  contactOutcome,
  contactNote,
  bookingOutcome,
  bookingNote,
  addNotePending,
  publishProgressPending,
  contactAttemptPending,
  bookingResultPending,
  onInternalNoteChange,
  onPatientProgressChange,
  onContactOutcomeChange,
  onContactNoteChange,
  onBookingOutcomeChange,
  onBookingNoteChange,
  onAddNote,
  onPublishProgress,
  onRecordContactAttempt,
  onRecordBookingResult,
}: ReferralCommunicationSectionsProps) {
  const copy = getReferralCopy(lang);

  return (
    <>
      {taskKind !== "terminal" ? (
        <SectionBox title={copy.admin.addNote} collapsible>
          <div className="space-y-2">
            <Textarea
              value={internalNote}
              onChange={event => onInternalNoteChange(event.target.value)}
              placeholder={copy.admin.note}
              className="min-h-24 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={addNotePending || internalNote.trim().length < 1}
              onClick={onAddNote}
            >
              {copy.admin.addNote}
            </Button>
          </div>
        </SectionBox>
      ) : null}

      {taskKind !== "terminal" ? (
        <SectionBox title={copy.admin.patientProgressTitle} collapsible>
          <div className="space-y-2">
            <Textarea
              value={patientProgressUpdate}
              onChange={event => onPatientProgressChange(event.target.value)}
              placeholder={copy.admin.patientProgressPlaceholder}
              className="min-h-24 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                publishProgressPending ||
                patientProgressUpdate.trim().length < 1
              }
              onClick={onPublishProgress}
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
                onContactOutcomeChange(event.target.value as ContactOutcome)
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
              onChange={event => onContactNoteChange(event.target.value)}
              placeholder={copy.admin.note}
              className="min-h-24 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={contactAttemptPending || contactNote.trim().length < 1}
              onClick={onRecordContactAttempt}
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
                onBookingOutcomeChange(event.target.value as BookingOutcome)
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
              onChange={event => onBookingNoteChange(event.target.value)}
              placeholder={copy.admin.note}
              className="min-h-24 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={bookingResultPending || bookingNote.trim().length < 1}
              onClick={onRecordBookingResult}
            >
              {copy.admin.bookingResultTitle}
            </Button>
          </div>
        </SectionBox>
      ) : null}
    </>
  );
}
