import {
  formatDate,
  toOperatorBadgeClass,
  toReasonLabel,
  toWebhookBadgeClass,
  toWebhookOutcome,
  toWebhookTypeLabel,
} from "@/features/admin/utils/adminFormatting";
import type { AppointmentDetailData } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type DiagnosticsSectionProps = {
  tr: TranslateFn;
  lang: "zh" | "en";
  locale: string;
  detailData: AppointmentDetailData;
};

export function DiagnosticsSection({ tr, lang, locale, detailData }: DiagnosticsSectionProps) {
  return (
    <>
      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("有效访问令牌", "Active Tokens")}</p>
        {detailData?.activeTokens?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Role</th>
                  <th className="px-2 py-1 text-left">Uses</th>
                  <th className="px-2 py-1 text-left">Last Used</th>
                  <th className="px-2 py-1 text-left">Expires</th>
                  <th className="px-2 py-1 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {detailData.activeTokens.map(token => (
                  <tr key={token.id} className="border-b">
                    <td className="px-2 py-1">{token.role}</td>
                    <td className="px-2 py-1">
                      {token.useCount}/{token.maxUses}
                    </td>
                    <td className="px-2 py-1">{formatDate(token.lastUsedAt, locale)}</td>
                    <td className="px-2 py-1">{formatDate(token.expiresAt, locale)}</td>
                    <td className="px-2 py-1">{token.ipFirstSeen || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("暂无有效令牌。", "No active tokens.")}</p>
        )}
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("状态时间线", "Status Timeline")}</p>
        {detailData?.statusEvents?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Time</th>
                  <th className="px-2 py-1 text-left">From</th>
                  <th className="px-2 py-1 text-left">To</th>
                  <th className="px-2 py-1 text-left">Operator</th>
                  <th className="px-2 py-1 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {detailData.statusEvents.map(event => (
                  <tr key={event.id} className="border-b">
                    <td className="px-2 py-1">{formatDate(event.createdAt, locale)}</td>
                    <td className="px-2 py-1">{event.fromStatus || "-"}</td>
                    <td className="px-2 py-1">{event.toStatus}</td>
                    <td className="px-2 py-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toOperatorBadgeClass(event.operatorType)}`}
                      >
                        {event.operatorType}
                        {typeof event.operatorId === "number" ? `:${event.operatorId}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-1">{toReasonLabel(event.reason, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("暂无状态事件。", "No status events.")}</p>
        )}
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("Stripe Webhook 事件", "Stripe Webhook Events")}</p>
        {detailData?.webhookEvents?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Time</th>
                  <th className="px-2 py-1 text-left">Event ID</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Outcome</th>
                  <th className="px-2 py-1 text-left">Stripe Session</th>
                  <th className="px-2 py-1 text-left">Appointment</th>
                </tr>
              </thead>
              <tbody>
                {detailData.webhookEvents.map(event => {
                  const outcome = toWebhookOutcome(event.type);
                  return (
                    <tr key={event.eventId} className="border-b">
                      <td className="px-2 py-1">{formatDate(event.createdAt, locale)}</td>
                      <td className="px-2 py-1">{event.eventId}</td>
                      <td className="px-2 py-1">{toWebhookTypeLabel(event.type, lang)}</td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toWebhookBadgeClass(outcome)}`}
                        >
                          {outcome}
                        </span>
                      </td>
                      <td className="px-2 py-1">{event.stripeSessionId || "-"}</td>
                      <td className="px-2 py-1">{event.appointmentId ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("暂无 webhook 事件。", "No webhook events.")}</p>
        )}
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("最近会诊消息", "Recent Visit Messages")}</p>
        {detailData?.recentMessages?.length ? (
          <div className="overflow-auto rounded border">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-2 py-1 text-left">Time</th>
                  <th className="px-2 py-1 text-left">Sender</th>
                  <th className="px-2 py-1 text-left">Displayed</th>
                  <th className="px-2 py-1 text-left">Original</th>
                  <th className="px-2 py-1 text-left">Lang</th>
                </tr>
              </thead>
              <tbody>
                {detailData.recentMessages.map(message => (
                  <tr key={message.id} className="border-b align-top">
                    <td className="px-2 py-1 whitespace-nowrap">{formatDate(message.createdAt, locale)}</td>
                    <td className="px-2 py-1">{message.senderType}</td>
                    <td className="px-2 py-1 max-w-[320px] break-words">
                      {message.translatedContent || message.content || "-"}
                    </td>
                    <td className="px-2 py-1 max-w-[320px] break-words">{message.originalContent || "-"}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {(message.sourceLanguage || "auto") +
                        " -> " +
                        (message.targetLanguage || "auto")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("暂无会诊消息。", "No visit messages yet.")}</p>
        )}
      </div>
    </>
  );
}
