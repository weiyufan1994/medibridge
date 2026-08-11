import { TabsContent } from "@/components/ui/tabs";
import {
  formatReferralDateTime,
  getReferralCopy,
  getReferralStatusLabel,
} from "@/features/referrals";
import type { ReferralOrderStatus } from "@shared/referrals";
import { SectionBox } from "./ReferralAdminPrimitives";

type TimelineItem = {
  id: number;
  toStatus: ReferralOrderStatus;
  createdAt: Date | string;
  reason: string | null;
};

type OperationItem = {
  id: number;
  actionType: string;
  createdAt: Date | string;
  actionPayload: unknown;
};

type NotificationFailureItem = {
  id: number;
  eventType: string;
  recipientType: string;
  recipient: string;
  attemptCount: number;
  lastError: string | null;
};

type ReferralTimelineSectionProps = {
  lang: "en" | "zh";
  timeline: TimelineItem[];
  operations: OperationItem[];
  notificationFailures: NotificationFailureItem[];
};

function formatPayload(value: unknown) {
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

export function ReferralTimelineSection({
  lang,
  timeline,
  operations,
  notificationFailures,
}: ReferralTimelineSectionProps) {
  const copy = getReferralCopy(lang);

  return (
    <TabsContent value="timeline" className="min-h-0 overflow-y-auto p-4">
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionBox title={copy.admin.timeline}>
          <div className="space-y-2">
            {timeline.map(event => (
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
            {operations.map(operation => (
              <div
                key={operation.id}
                className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {operation.actionType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatReferralDateTime(operation.createdAt, lang)}
                  </span>
                </div>
                {operation.actionPayload ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-tight text-muted-foreground">
                    {formatPayload(operation.actionPayload)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </SectionBox>

        <SectionBox title={copy.admin.notificationFailures}>
          {notificationFailures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {copy.admin.noNotificationFailures}
            </p>
          ) : (
            <div className="space-y-2">
              {notificationFailures.map(failure => (
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
  );
}
