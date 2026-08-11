import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getReferralCopy } from "@/features/referrals";
import type { ReferralOrderStatus } from "@shared/referrals";
import type { ReferralConsultationDraftIssue } from "../../referralConsultationDraft";
import type { ReferralAdminTaskKind } from "../../referralAdminPresentation";
import { FieldShell, SectionBox } from "./ReferralAdminPrimitives";

type ReferralConsultationSectionProps = {
  lang: "en" | "zh";
  orderId: number;
  orderStatus: ReferralOrderStatus;
  taskKind: ReferralAdminTaskKind | null;
  consultationTimeInput: string;
  consultationTimeZone: string;
  consultationProviderName: string;
  consultationPlatform: string;
  consultationJoinUrl: string;
  consultationInstructions: string;
  consultationNote: string;
  consultationDraftIssues: ReferralConsultationDraftIssue[];
  consultationDraftIsDirty: boolean;
  beginCoordinationPending: boolean;
  saveConsultationPending: boolean;
  onConsultationTimeInputChange: (value: string) => void;
  onConsultationTimeZoneChange: (value: string) => void;
  onConsultationProviderNameChange: (value: string) => void;
  onConsultationPlatformChange: (value: string) => void;
  onConsultationJoinUrlChange: (value: string) => void;
  onConsultationInstructionsChange: (value: string) => void;
  onConsultationNoteChange: (value: string) => void;
  onBeginCoordination: () => void;
  onSaveConsultation: () => void;
};

export function ReferralConsultationSection({
  lang,
  orderId,
  orderStatus,
  taskKind,
  consultationTimeInput,
  consultationTimeZone,
  consultationProviderName,
  consultationPlatform,
  consultationJoinUrl,
  consultationInstructions,
  consultationNote,
  consultationDraftIssues,
  consultationDraftIsDirty,
  beginCoordinationPending,
  saveConsultationPending,
  onConsultationTimeInputChange,
  onConsultationTimeZoneChange,
  onConsultationProviderNameChange,
  onConsultationPlatformChange,
  onConsultationJoinUrlChange,
  onConsultationInstructionsChange,
  onConsultationNoteChange,
  onBeginCoordination,
  onSaveConsultation,
}: ReferralConsultationSectionProps) {
  const copy = getReferralCopy(lang);
  const consultationIssueMessages: Record<
    ReferralConsultationDraftIssue,
    string
  > = copy.admin.consultationValidationIssues;
  const shouldShow =
    taskKind === "coordinate_time" ||
    taskKind === "schedule" ||
    taskKind === "complete";

  if (!shouldShow) {
    return null;
  }

  return (
    <SectionBox title={copy.admin.consultationTimeTitle}>
      <div className="space-y-2">
        {taskKind === "coordinate_time" ? (
          <>
            <Textarea
              value={consultationNote}
              onChange={event => onConsultationNoteChange(event.target.value)}
              placeholder={copy.admin.consultationTimeNote}
              className="min-h-24 px-2 py-1 text-sm leading-tight"
            />
            <Button
              size="sm"
              disabled={
                beginCoordinationPending || consultationNote.trim().length < 1
              }
              onClick={onBeginCoordination}
            >
              {copy.admin.beginTimeCoordination}
            </Button>
          </>
        ) : (
          <>
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              {copy.admin.consultationScheduleHint}
            </p>
            <FieldShell label={copy.admin.consultationTimeInput}>
              <Input
                className="h-8"
                type="datetime-local"
                value={consultationTimeInput}
                aria-invalid={
                  consultationDraftIssues.includes(
                    "consultation_time_required"
                  ) ||
                  consultationDraftIssues.includes("consultation_time_invalid")
                }
                onChange={event =>
                  onConsultationTimeInputChange(event.target.value)
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
                  onConsultationTimeZoneChange(event.target.value)
                }
                placeholder={copy.admin.consultationTimeZone}
              />
            </FieldShell>
            <FieldShell label={copy.admin.consultationProviderName}>
              <Input
                className="h-8"
                value={consultationProviderName}
                aria-invalid={consultationDraftIssues.includes(
                  "provider_required"
                )}
                onChange={event =>
                  onConsultationProviderNameChange(event.target.value)
                }
                placeholder={copy.admin.consultationProviderName}
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
                  onConsultationPlatformChange(event.target.value)
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
                  consultationDraftIssues.includes("join_url_required") ||
                  consultationDraftIssues.includes("join_url_https_required")
                }
                onChange={event =>
                  onConsultationJoinUrlChange(event.target.value)
                }
                placeholder={copy.admin.consultationJoinUrl}
              />
            </FieldShell>
            <FieldShell label={copy.admin.consultationInstructions}>
              <Textarea
                value={consultationInstructions}
                aria-invalid={consultationDraftIssues.includes(
                  "instructions_required"
                )}
                onChange={event =>
                  onConsultationInstructionsChange(event.target.value)
                }
                placeholder={copy.admin.consultationInstructions}
                className="min-h-24 px-2 py-1 text-sm leading-tight"
              />
            </FieldShell>
            <FieldShell label={copy.admin.consultationTimeNote}>
              <Textarea
                value={consultationNote}
                onChange={event => onConsultationNoteChange(event.target.value)}
                placeholder={copy.admin.consultationTimeNote}
                className="min-h-24 px-2 py-1 text-sm leading-tight"
              />
            </FieldShell>
            {consultationDraftIssues.length > 0 ? (
              <div
                id={`referral-consultation-validation-${orderId}`}
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <p className="font-medium">
                  {copy.admin.consultationValidationTitle}
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {consultationDraftIssues.map(issue => (
                    <li key={issue}>{consultationIssueMessages[issue]}</li>
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
                orderStatus === "time_coordination" ? "default" : "outline"
              }
              aria-describedby={
                consultationDraftIssues.length > 0
                  ? `referral-consultation-validation-${orderId}`
                  : undefined
              }
              disabled={
                saveConsultationPending ||
                (orderStatus !== "time_coordination" &&
                  orderStatus !== "scheduled") ||
                consultationDraftIssues.length > 0
              }
              onClick={onSaveConsultation}
            >
              {orderStatus === "time_coordination"
                ? copy.admin.saveAndScheduleConsultation
                : copy.admin.saveConsultationArrangement}
            </Button>
          </>
        )}
      </div>
    </SectionBox>
  );
}
