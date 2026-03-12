import {
  formatDate,
  toOperatorBadgeClass,
  toReasonLabel,
  toWebhookBadgeClass,
  toWebhookOutcome,
  toWebhookTypeLabel,
} from "@/features/admin/utils/adminFormatting";
import { useMemo, useState } from "react";
import type { AppointmentDetailData } from "@/features/admin/types";
import { Button } from "@/components/ui/button";

type TranslateFn = (zh: string, en: string) => string;

type DiagnosticsSectionProps = {
  tr: TranslateFn;
  lang: "zh" | "en";
  locale: string;
  detailData: AppointmentDetailData;
  canReplayWebhook: boolean;
  webhookReplayMutation: {
    isPending: boolean;
    replayByEvent: (input: { eventId?: string; appointmentId?: number }) => void;
  };
};

export function DiagnosticsSection({
  tr,
  lang,
  locale,
  detailData,
  canReplayWebhook,
  webhookReplayMutation,
}: DiagnosticsSectionProps) {
  const [webhookTypeFilter, setWebhookTypeFilter] = useState("all");
  const webhookEvents = detailData.webhookEvents ?? [];
  const webhookTypes = useMemo(() => {
    const values = new Set(webhookEvents.map(item => item.type));
    return ["all", ...Array.from(values)].sort();
  }, [webhookEvents]);
  const filteredWebhookEvents = useMemo(
    () =>
      webhookTypeFilter === "all"
        ? webhookEvents
        : webhookEvents.filter(event => event.type === webhookTypeFilter),
    [webhookEvents, webhookTypeFilter]
  );
  const replayDisabledReason = tr(
    "仅管理员与 ops 可重试 webhook。",
    "Only admin/ops can replay webhook events."
  );

  return (
    <>
      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("有效访问令牌", "Active Tokens")}</p>
        {detailData?.activeTokens?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b">
                  <th className="px-2 py-1 text-left">{tr("角色", "Role")}</th>
                  <th className="px-2 py-1 text-left">{tr("使用次数", "Uses")}</th>
                  <th className="px-2 py-1 text-left">{tr("上次使用", "Last Used")}</th>
                  <th className="px-2 py-1 text-left">{tr("过期时间", "Expires")}</th>
                  <th className="px-2 py-1 text-left">{tr("IP", "IP")}</th>
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
                      <th className="px-2 py-1 text-left">{tr("时间", "Time")}</th>
                      <th className="px-2 py-1 text-left">{tr("来源", "From")}</th>
                      <th className="px-2 py-1 text-left">{tr("目标", "To")}</th>
                      <th className="px-2 py-1 text-left">{tr("操作者", "Operator")}</th>
                      <th className="px-2 py-1 text-left">{tr("原因", "Reason")}</th>
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
        <div className="flex flex-wrap gap-2">
          <label className="w-full max-w-xs space-y-1">
            <span className="text-xs text-muted-foreground">
              {tr("按事件类型筛选", "Filter by event type")}
            </span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={webhookTypeFilter}
              onChange={event => setWebhookTypeFilter(event.target.value)}
            >
              {webhookTypes.map(type => (
                <option key={type} value={type}>
                  {type === "all" ? tr("全部", "All") : type}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filteredWebhookEvents.length ? (
          <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">{tr("时间", "Time")}</th>
                      <th className="px-2 py-1 text-left">{tr("事件 ID", "Event ID")}</th>
                      <th className="px-2 py-1 text-left">{tr("类型", "Type")}</th>
                      <th className="px-2 py-1 text-left">{tr("结果", "Outcome")}</th>
                      <th className="px-2 py-1 text-left">{tr("Stripe 会话", "Stripe Session")}</th>
                      <th className="px-2 py-1 text-left">{tr("预约", "Appointment")}</th>
                      <th className="px-2 py-1 text-left">{tr("运维动作", "Ops Action")}</th>
                    </tr>
                  </thead>
              <tbody>
                {filteredWebhookEvents.map(event => {
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
                      <td className="px-2 py-1">
                        {event.eventId ? (
                          canReplayWebhook ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={webhookReplayMutation.isPending}
                              onClick={() =>
                                webhookReplayMutation.replayByEvent({
                                  eventId: event.eventId,
                                  appointmentId: event.appointmentId ?? undefined,
                                })
                              }
                            >
                              {webhookReplayMutation.isPending
                                ? tr("重试中...", "Retrying...")
                                : tr("重试", "Retry")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled
                              title={replayDisabledReason}
                            >
                              {tr("无权重试", "No permission")}
                            </Button>
                          )
                        ) : (
                          "-"
                        )}
                      </td>
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
                  <th className="px-2 py-1 text-left">{tr("时间", "Time")}</th>
                  <th className="px-2 py-1 text-left">{tr("发送者", "Sender")}</th>
                  <th className="px-2 py-1 text-left">{tr("展示内容", "Displayed")}</th>
                  <th className="px-2 py-1 text-left">{tr("原文", "Original")}</th>
                  <th className="px-2 py-1 text-left">{tr("语言", "Lang")}</th>
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
