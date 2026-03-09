import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/features/admin/utils/adminFormatting";

type TranslateFn = (zh: string, en: string) => string;

type TriageSessionItem = {
  id: number;
  userId: number | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TriageSessionsCardProps = {
  tr: TranslateFn;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  items: TriageSessionItem[];
};

export function TriageSessionsCard({
  tr,
  locale,
  isLoading,
  errorMessage,
  items,
}: TriageSessionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("AI 分诊会话（最新 50 条）", "AI Triage Sessions (Latest 50)")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载分诊会话...", "Loading triage sessions...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">{tr("用户 ID", "User ID")}</th>
                  <th className="px-2 py-2 text-left">{tr("状态", "Status")}</th>
                  <th className="px-2 py-2 text-left">{tr("创建时间", "Created")}</th>
                  <th className="px-2 py-2 text-left">{tr("更新时间", "Updated")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2">{item.id}</td>
                    <td className="px-2 py-2">{item.userId ?? "-"}</td>
                    <td className="px-2 py-2">{item.status}</td>
                    <td className="px-2 py-2">{formatDate(item.createdAt, locale)}</td>
                    <td className="px-2 py-2">{formatDate(item.updatedAt, locale)}</td>
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
