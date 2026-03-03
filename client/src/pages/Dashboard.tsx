import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { VisitMessageBubble } from "@/features/visit/components/VisitMessageBubble";
import type { VisitMessageItem } from "@/features/visit/types";

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function toAppointmentTypeLabel(type: "online_chat" | "video_call" | "in_person") {
  if (type === "online_chat") return "Online chat";
  if (type === "video_call") return "Video call";
  return "In person";
}

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const usageQuery = trpc.ai.getUsageSummary.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const sessionsQuery = trpc.ai.listMySessions.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated }
  );
  const appointmentsQuery = trpc.appointments.listMine.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );

  const accountPlan = usageQuery.data?.role === "pro" ? "Pro" : "Free";
  const remainingText =
    usageQuery.data?.remainingToday === null || usageQuery.data?.remainingToday === undefined
      ? "Unlimited"
      : String(usageQuery.data.remainingToday);

  const appointmentPreviewMessages = useMemo<VisitMessageItem[]>(() => {
    return (appointmentsQuery.data ?? []).map(item => ({
      id: item.id,
      senderType: "system",
      content: `#${item.id} · ${toAppointmentTypeLabel(item.appointmentType)} · ${item.status} · ${formatDateTime(item.scheduledAt)}`,
      originalContent: `#${item.id} · ${toAppointmentTypeLabel(item.appointmentType)} · ${item.status} · ${formatDateTime(item.scheduledAt)}`,
      translatedContent: `#${item.id} · ${toAppointmentTypeLabel(item.appointmentType)} · ${item.status} · ${formatDateTime(item.scheduledAt)}`,
      sourceLanguage: "auto",
      targetLanguage: "auto",
      createdAt: item.createdAt,
      clientMsgId: null,
    }));
  }, [appointmentsQuery.data]);

  return (
    <AppLayout title="个人中心 / User Center" showBack={true}>
      <div className="mx-auto w-full max-w-6xl space-y-6 py-2">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            欢迎回来，{user?.name || user?.email || "MediBridge 用户"}
          </p>
        </header>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList>
            <TabsTrigger value="account">账户状态</TabsTrigger>
            <TabsTrigger value="consultations">我的问诊记录</TabsTrigger>
            <TabsTrigger value="appointments">我的行程</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Account & Billing</CardTitle>
                <Badge variant={accountPlan === "Pro" ? "default" : "secondary"}>
                  {accountPlan}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {usageQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载账户信息...
                  </div>
                ) : (
                  <>
                    <p>今日剩余可用问诊次数：{remainingText}</p>
                    <p className="text-muted-foreground">
                      累计 AI 会话数：{usageQuery.data?.totalSessions ?? 0}
                    </p>
                  </>
                )}
                <Button type="button">升级 Pro</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consultations">
            <Card>
              <CardHeader>
                <CardTitle>AI Consultations</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载问诊记录...
                  </div>
                ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {sessionsQuery.data.map(session => (
                      <div
                        key={session.id}
                        className="rounded-lg border bg-background p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">会话 #{session.id}</p>
                          <Badge
                            variant={
                              session.status === "completed" ? "secondary" : "default"
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-muted-foreground">
                          创建时间：{formatDateTime(session.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无 AI 问诊记录。</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <Card>
              <CardHeader>
                <CardTitle>Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {appointmentsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载行程...
                  </div>
                ) : appointmentPreviewMessages.length > 0 ? (
                  <div className="space-y-2">
                    {appointmentPreviewMessages.map((message, index) => (
                      <VisitMessageBubble
                        key={message.id}
                        message={message}
                        compactWithPrev={index > 0}
                        showTimestamp={false}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无就诊行程。</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
