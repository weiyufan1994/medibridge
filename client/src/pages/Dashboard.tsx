import { useState } from "react";
import { Loader2, Sparkles, Activity, Bot, User, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { MyAppointments } from "@/components/MyAppointments";
import { getDashboardCopy } from "@/features/dashboard/copy";
import PricingModal from "@/features/dashboard/components/PricingModal";

function formatDateTime(value: Date | string | null, locale?: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale);
}

function StatCard(props: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: "blue" | "emerald";
}) {
  const accentClasses = "bg-emerald-50 text-emerald-600";

  return (
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <CardContent className="flex items-center justify-between p-6">
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{props.title}</p>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{props.value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClasses}`}>
          {props.icon}
        </div>
      </CardContent>
    </Card>
  );
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
  const displayName = user?.email || user?.name || t.fallbackUserName;
  const [activeSection, setActiveSection] = useState<"account" | "consultations" | "appointments">(
    "account"
  );
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const navItems = [
    { key: "account", label: t.sidebarAccountOverview, icon: User },
    { key: "consultations", label: t.sidebarAiConsultations, icon: MessageSquare },
    { key: "appointments", label: t.sidebarMyAppointments, icon: Calendar },
  ] as const;

  return (
    <DashboardLayout
      items={[...navItems]}
      activeKey={activeSection}
      onChange={key => setActiveSection(key as "account" | "consultations" | "appointments")}
    >
      {activeSection === "account" ? (
        <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {t.welcomeBack.replace("{{name}}", displayName)}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-gray-500">
                    {resolved === "zh"
                      ? "这是你的健康驾驶舱，查看今日 AI 咨询额度与历史问诊数据。"
                      : "Your health cockpit for tracking AI consultation quota and history."}
                  </p>
                </div>
                <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                  {accountPlan}
                </Badge>
              </div>

              {usageQuery.isLoading ? (
                <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loadingAccount}
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <StatCard
                    title={t.remainingToday.replace("{{count}}", "")}
                    value={remainingText}
                    accent="blue"
                    icon={<Sparkles className="h-5 w-5" />}
                  />
                  <StatCard
                    title={t.totalSessions.replace("{{count}}", "")}
                    value={String(usageQuery.data?.totalSessions ?? 0)}
                    accent="emerald"
                    icon={<Activity className="h-5 w-5" />}
                  />
                </div>
              )}

              {accountPlan !== "Pro" ? (
                <div className="mt-6">
                  <Button
                    type="button"
                    className="rounded-xl bg-teal-600 px-5 text-white hover:bg-teal-700"
                    onClick={() => setIsPricingModalOpen(true)}
                  >
                    {t.upgradePro}
                  </Button>
                </div>
              ) : null}
        </section>
      ) : null}

      <PricingModal
        open={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      {activeSection === "consultations" ? (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-6">
                {sessionsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingConsultations}
                  </div>
                ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {sessionsQuery.data.map(session => (
                      <div
                        key={session.id}
                        className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">
                                {t.sessionLabel.replace("{{id}}", String(session.id))}
                              </p>
                              <p className="text-xs text-slate-400">
                                {resolved === "zh"
                                  ? "AI 诊断摘要占位，后续可展示自动总结。"
                                  : "AI diagnostic summary placeholder for future auto-generated insight."}
                              </p>
                            </div>
                          </div>
                          <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-slate-500">
                          {t.createdAt.replace("{{time}}", formatDateTime(session.createdAt, locale))}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t.noConsultations}</p>
                )}
              </CardContent>
        </Card>
      ) : null}

      {activeSection === "appointments" ? <MyAppointments /> : null}
    </DashboardLayout>
  );
}
