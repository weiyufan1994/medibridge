import { useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Activity,
  Bot,
  User,
  MessageSquare,
  Calendar,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { MyAppointments } from "@/components/MyAppointments";
import { getDashboardCopy } from "@/features/dashboard/copy";
import { getDisplayLocale } from "@/lib/i18n";
import PricingModal from "@/features/dashboard/components/PricingModal";
import { useLocation } from "wouter";

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
  const locale = getDisplayLocale(resolved);
  const [, setLocation] = useLocation();

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

  const sessionCards = useMemo(() => {
    return (sessionsQuery.data ?? []).map(session => {
      const hasSummary =
        typeof session.summary === "string" && session.summary.trim().length > 0;
      const summary = hasSummary
        ? session.summary!.trim()
        : session.status === "completed"
          ? t.completedSummaryFallback
          : t.activeSummaryFallback;

      const summaryTitle = hasSummary
        ? summary.slice(0, 48)
        : t.sessionLabel.replace("{{id}}", String(session.id));

      return {
        ...session,
        summary,
        summaryTitle,
        actionLabel:
          session.status === "completed" ? t.reviewRecord : t.continueTriage,
        statusLabel:
          session.status === "completed" ? t.statusCompleted : t.statusActive,
      };
    });
  }, [sessionsQuery.data, t]);

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
                    {t.accountHeroDescription}
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
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {t.triageArchiveTitle}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                      {t.aiConsultations}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate-500">
                      {t.triageArchiveDesc}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={() => setLocation("/triage")}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {t.continueTriage}
                  </Button>
                </div>

                {sessionsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingConsultations}
                  </div>
                ) : sessionCards.length > 0 ? (
                  <div className="space-y-4">
                    {sessionCards.map(session => (
                      <div
                        key={session.id}
                        className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-base font-semibold text-slate-900">
                                  {session.summaryTitle}
                                </p>
                                <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">
                                  {session.statusLabel}
                                </Badge>
                              </div>
                              <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                                {session.summary}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                          <span>
                            {t.createdAt.replace(
                              "{{time}}",
                              formatDateTime(session.createdAt, locale)
                            )}
                          </span>
                          <span>
                            {t.updatedAt.replace(
                              "{{time}}",
                              formatDateTime(session.updatedAt, locale)
                            )}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                            onClick={() => setLocation(`/triage?id=${session.id}`)}
                          >
                            {session.actionLabel}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          {session.status === "completed" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl border-slate-200"
                              onClick={() => setLocation("/triage")}
                            >
                              {t.continueTriage}
                            </Button>
                          ) : null}
                        </div>
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
