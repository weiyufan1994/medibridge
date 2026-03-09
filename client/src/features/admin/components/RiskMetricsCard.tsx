import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TranslateFn = (zh: string, en: string) => string;

type RiskMetricsCardProps = {
  tr: TranslateFn;
  isLoading: boolean;
  errorMessage?: string;
  generatedAt?: string;
  counters: unknown[];
};

export function RiskMetricsCard({
  tr,
  isLoading,
  errorMessage,
  generatedAt,
  counters,
}: RiskMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("风险指标", "Risk Metrics")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载指标...", "Loading metrics...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {tr("生成时间", "Generated at")}: {generatedAt}
            </p>
            <div className="max-h-64 overflow-auto rounded border p-2">
              <pre className="text-xs">{JSON.stringify(counters, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
