import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchedulingManagement } from "@/features/admin/hooks/useSchedulingManagement";
import { SchedulingExceptionsPanel } from "./SchedulingExceptionsPanel";
import { SchedulingRulesPanel } from "./SchedulingRulesPanel";
import { SchedulingSlotsPanel } from "./SchedulingSlotsPanel";

export { getSchedulingDoctorLabel } from "@/features/admin/schedulingPresentation";

type TranslateFn = (zh: string, en: string) => string;

type Props = {
  tr: TranslateFn;
  lang: "zh" | "en";
  isReadOnly?: boolean;
};

export function SchedulingManagementCard({
  tr,
  lang,
  isReadOnly = false,
}: Props) {
  const scheduling = useSchedulingManagement({ tr, lang });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {tr("排班与 Slot 管理", "Scheduling & Slot Management")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px,1fr,auto]">
          <div>
            <Label htmlFor="admin-scheduling-doctor-id">
              {tr("医生 ID", "Doctor ID")}
            </Label>
            <Input
              id="admin-scheduling-doctor-id"
              value={scheduling.doctorIdInput}
              onChange={event =>
                scheduling.setDoctorIdInput(event.target.value)
              }
              placeholder={tr("例如 11", "e.g. 11")}
              disabled={scheduling.isBusy}
            />
          </div>
          <div className="rounded border bg-admin-surface-muted px-3 py-2 text-sm text-foreground">
            <div className="font-medium">{scheduling.doctorLabel}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {tr(
                "后台可先配置规则、例外和 manual slots，患者端只消费真实可售 slot。",
                "Admin can configure rules, exceptions, and manual slots first; patients only consume real sellable slots."
              )}
            </div>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void scheduling.refreshAll()}
              disabled={!scheduling.hasDoctorId || scheduling.isBusy}
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              {tr("刷新", "Refresh")}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules">{tr("规则", "Rules")}</TabsTrigger>
            <TabsTrigger value="exceptions">
              {tr("例外", "Exceptions")}
            </TabsTrigger>
            <TabsTrigger value="slots">{tr("Slots", "Slots")}</TabsTrigger>
          </TabsList>
          <TabsContent value="rules" className="space-y-4">
            <SchedulingRulesPanel
              scheduling={scheduling}
              tr={tr}
              lang={lang}
              isReadOnly={isReadOnly}
            />
          </TabsContent>
          <TabsContent value="exceptions" className="space-y-4">
            <SchedulingExceptionsPanel
              scheduling={scheduling}
              tr={tr}
              lang={lang}
              isReadOnly={isReadOnly}
            />
          </TabsContent>
          <TabsContent value="slots" className="space-y-4">
            <SchedulingSlotsPanel
              scheduling={scheduling}
              tr={tr}
              lang={lang}
              isReadOnly={isReadOnly}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
