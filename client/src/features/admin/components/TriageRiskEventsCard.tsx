import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/features/admin/utils/adminFormatting";
import type { AdminTriageRiskEventItem } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type TriageRiskEventsCardProps = {
  tr: TranslateFn;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  items: AdminTriageRiskEventItem[];
};

export function TriageRiskEventsCard({
  tr,
  locale,
  isLoading,
  errorMessage,
  items,
}: TriageRiskEventsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("分诊风险事件", "Triage Risk Events")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载风险事件...", "Loading risk events...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr("暂无分诊风险事件。", "No triage risk events yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">{tr("会话 ID", "Session ID")}</th>
                  <th className="px-2 py-2 text-left">{tr("风险码", "Risk Code")}</th>
                  <th className="px-2 py-2 text-left">{tr("级别", "Severity")}</th>
                  <th className="px-2 py-2 text-left">{tr("建议动作", "Action")}</th>
                  <th className="px-2 py-2 text-left">{tr("知识命中", "Knowledge Hits")}</th>
                  <th className="px-2 py-2 text-left">{tr("触发内容", "Excerpt")}</th>
                  <th className="px-2 py-2 text-left">{tr("时间", "Created")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b align-top">
                    <td className="px-2 py-2">{item.id}</td>
                    <td className="px-2 py-2">{item.sessionId}</td>
                    <td className="px-2 py-2">
                      <Badge className="border-0 bg-rose-100 text-rose-800">{item.riskCode}</Badge>
                    </td>
                    <td className="px-2 py-2">{item.severity}</td>
                    <td className="px-2 py-2">{item.recommendedAction}</td>
                    <td className="px-2 py-2">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-700">
                          {item.knowledgeTrace?.mode ?? "-"}
                        </p>
                        {item.knowledgeTrace?.documentTitles?.slice(0, 2).map(title => (
                          <p key={title} className="max-w-[220px] truncate text-xs text-slate-500">
                            {title}
                          </p>
                        ))}
                        {(item.knowledgeTrace?.queryTerms?.length ?? 0) > 0 && (
                          <p className="max-w-[220px] truncate text-xs text-slate-500">
                            {(item.knowledgeTrace?.queryTerms ?? []).join(", ")}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[340px] px-2 py-2 text-xs text-slate-600">
                      <p className="line-clamp-3 whitespace-pre-wrap">{item.rawExcerpt || "-"}</p>
                    </td>
                    <td className="px-2 py-2">{formatDate(item.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
