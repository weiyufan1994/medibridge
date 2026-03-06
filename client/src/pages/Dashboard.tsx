import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { MyAppointments } from "@/components/MyAppointments";
import { getDashboardCopy } from "@/features/dashboard/copy";

function formatDateTime(value: Date | string | null, locale?: string) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString(locale);
}

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { resolved } = useLanguage();
  const t = getDashboardCopy(resolved);
  const locale = resolved === "zh" ? "zh-CN" : "en-US";
  const usageQuery = trpc.ai.getUsageSummary.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const sessionsQuery = trpc.ai.listMySessions.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated }
  );

  const accountPlan = usageQuery.data?.role === "pro" ? "Pro" : "Free";
  const remainingText =
    usageQuery.data?.remainingToday === null || usageQuery.data?.remainingToday === undefined
      ? t.unlimited
      : String(usageQuery.data.remainingToday);
  const displayName = user?.name || user?.email || t.fallbackUserName;

  return (
    <AppLayout title={t.appLayoutTitle} showBack={true}>
      <div className="mx-auto w-full max-w-6xl space-y-6 py-2">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.welcomeBack.replace("{{name}}", displayName)}
          </p>
        </header>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList>
            <TabsTrigger value="account">{t.tabAccount}</TabsTrigger>
            <TabsTrigger value="consultations">{t.tabConsultations}</TabsTrigger>
            <TabsTrigger value="appointments">{t.tabAppointments}</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t.accountBilling}</CardTitle>
                <Badge variant={accountPlan === "Pro" ? "default" : "secondary"}>
                  {accountPlan}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {usageQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingAccount}
                  </div>
                ) : (
                  <>
                    <p>{t.remainingToday.replace("{{count}}", remainingText)}</p>
                    <p className="text-muted-foreground">
                      {t.totalSessions.replace(
                        "{{count}}",
                        String(usageQuery.data?.totalSessions ?? 0)
                      )}
                    </p>
                  </>
                )}
                {accountPlan !== "Pro" ? (
                  <Button type="button">{t.upgradePro}</Button>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consultations">
            <Card>
              <CardHeader>
                <CardTitle>{t.aiConsultations}</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingConsultations}
                  </div>
                ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {sessionsQuery.data.map(session => (
                      <div
                        key={session.id}
                        className="rounded-lg border bg-background p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">
                            {t.sessionLabel.replace("{{id}}", String(session.id))}
                          </p>
                          <Badge
                            variant={
                              session.status === "completed" ? "secondary" : "default"
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-muted-foreground">
                          {t.createdAt.replace(
                            "{{time}}",
                            formatDateTime(session.createdAt, locale)
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.noConsultations}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <MyAppointments />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
