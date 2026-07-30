import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminOverviewCopy, type AdminLang } from "@/features/admin/copy";
import { formatDate } from "@/features/admin/utils/adminFormatting";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ADMIN_OVERVIEW_REFERRAL_STATUS,
  getAdminOverviewTodayStart,
} from "@/features/admin/adminOverviewPresentation";

type AdminOverviewProps = {
  lang: AdminLang;
  locale: string;
  canReadAdmin: boolean;
  onOpenAppointment: (appointmentId: number) => void;
  onOpenReferral: (orderId: number) => void;
};

type PriorityTask =
  | {
      kind: "appointment";
      id: number;
      title: string;
      detail: string;
      createdAt: Date | string;
    }
  | {
      kind: "referral";
      id: number;
      title: string;
      detail: string;
      createdAt: Date | string;
    };

export function AdminOverview({
  lang,
  locale,
  canReadAdmin,
  onOpenAppointment,
  onOpenReferral,
}: AdminOverviewProps) {
  const copy = getAdminOverviewCopy(lang);
  const todayStart = useMemo(() => getAdminOverviewTodayStart(new Date()), []);

  const todayAppointmentsQuery = trpc.system.adminAppointments.useQuery(
    {
      page: 1,
      pageSize: 1,
      createdAtFrom: todayStart,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
    { enabled: canReadAdmin }
  );
  const riskAppointmentsQuery = trpc.system.adminAppointments.useQuery(
    {
      page: 1,
      pageSize: 5,
      hasRisk: true,
      sortBy: "createdAt",
      sortDirection: "asc",
    },
    { enabled: canReadAdmin }
  );
  const unassignedReferralsQuery = trpc.referrals.listOrders.useQuery(
    {
      page: 1,
      pageSize: 5,
      status: ADMIN_OVERVIEW_REFERRAL_STATUS.unassigned,
      sortDirection: "asc",
    },
    { enabled: canReadAdmin }
  );
  const refundReviewsQuery = trpc.referrals.listOrders.useQuery(
    {
      page: 1,
      pageSize: 5,
      status: ADMIN_OVERVIEW_REFERRAL_STATUS.refundReview,
      sortDirection: "asc",
    },
    { enabled: canReadAdmin }
  );

  const queries = [
    todayAppointmentsQuery,
    riskAppointmentsQuery,
    unassignedReferralsQuery,
    refundReviewsQuery,
  ];
  const isLoading = queries.some(query => query.isLoading);
  const hasError = queries.some(query => Boolean(query.error));

  const tasks = useMemo<PriorityTask[]>(() => {
    const appointmentTasks: PriorityTask[] = (
      riskAppointmentsQuery.data?.items ?? []
    ).map(item => ({
      kind: "appointment",
      id: item.id,
      title: `#${item.id} · ${item.email}`,
      detail: copy.riskReason,
      createdAt: item.createdAt,
    }));

    const referralTasks = [
      ...(unassignedReferralsQuery.data?.items ?? []).map(item => ({
        kind: "referral" as const,
        id: item.id,
        title: `#${item.id} · ${
          getLocalizedText({ lang, value: item.hospitalName }).trim() || "—"
        }`,
        detail: copy.waitingAssignment,
        createdAt: item.createdAt,
      })),
      ...(refundReviewsQuery.data?.items ?? []).map(item => ({
        kind: "referral" as const,
        id: item.id,
        title: `#${item.id} · ${
          getLocalizedText({ lang, value: item.hospitalName }).trim() || "—"
        }`,
        detail: copy.awaitingRefundReview,
        createdAt: item.updatedAt,
      })),
    ];

    return [...referralTasks, ...appointmentTasks].slice(0, 12);
  }, [
    copy.awaitingRefundReview,
    copy.riskReason,
    copy.waitingAssignment,
    lang,
    refundReviewsQuery.data?.items,
    riskAppointmentsQuery.data?.items,
    unassignedReferralsQuery.data?.items,
  ]);

  const refresh = () => {
    void Promise.all(queries.map(query => query.refetch()));
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <section aria-labelledby="admin-overview-metrics">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="admin-overview-metrics"
            className="text-sm font-semibold text-admin-foreground"
          >
            {copy.needsAttention}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={isLoading}
          >
            <RotateCw className={cn("size-4", isLoading && "animate-spin")} />
            {copy.refresh}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetric
            icon={CalendarDays}
            label={copy.todayAppointments}
            value={todayAppointmentsQuery.data?.total}
            scope={copy.todayScope}
            isLoading={todayAppointmentsQuery.isLoading}
          />
          <OverviewMetric
            icon={AlertTriangle}
            label={copy.riskAppointments}
            value={riskAppointmentsQuery.data?.total}
            scope={copy.currentScope}
            isLoading={riskAppointmentsQuery.isLoading}
            tone="danger"
          />
          <OverviewMetric
            icon={ClipboardList}
            label={copy.unassignedReferrals}
            value={unassignedReferralsQuery.data?.total}
            scope={copy.currentScope}
            isLoading={unassignedReferralsQuery.isLoading}
            tone="warning"
          />
          <OverviewMetric
            icon={CircleDollarSign}
            label={copy.refundReviews}
            value={refundReviewsQuery.data?.total}
            scope={copy.currentScope}
            isLoading={refundReviewsQuery.isLoading}
            tone="warning"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-admin-border bg-admin-surface">
        <div className="flex items-start justify-between gap-4 border-b border-admin-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-admin-foreground">
              {copy.taskQueue}
            </h2>
            <p className="mt-1 text-xs text-admin-muted-foreground">
              {copy.taskQueueDescription}
            </p>
          </div>
          {hasError ? (
            <span className="text-xs text-destructive">{copy.loadFailed}</span>
          ) : null}
        </div>

        {isLoading && tasks.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-admin-muted-foreground">
            {copy.noTasks}
          </div>
        ) : (
          <div className="divide-y divide-admin-border">
            {tasks.map(task => (
              <button
                key={`${task.kind}-${task.id}`}
                type="button"
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-admin-surface-muted"
                onClick={() =>
                  task.kind === "appointment"
                    ? onOpenAppointment(task.id)
                    : onOpenReferral(task.id)
                }
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    task.kind === "appointment" ? "bg-rose-500" : "bg-amber-500"
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-admin-foreground">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-admin-muted-foreground">
                    {task.detail} · {formatDate(task.createdAt, locale)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-admin-accent-foreground">
                  {task.kind === "appointment"
                    ? copy.openAppointment
                    : copy.openReferral}
                  <ArrowUpRight className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  scope,
  isLoading,
  tone = "neutral",
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number | undefined;
  scope: string;
  isLoading: boolean;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <article className="rounded-xl border border-admin-border bg-admin-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-admin-muted-foreground">
          {label}
        </p>
        <Icon
          className={cn(
            "size-4",
            tone === "danger"
              ? "text-rose-600"
              : tone === "warning"
                ? "text-amber-600"
                : "text-admin-accent-foreground"
          )}
        />
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-admin-foreground">
          {Intl.NumberFormat().format(value ?? 0)}
        </p>
      )}
      <p className="mt-1 text-[11px] text-admin-muted-foreground">{scope}</p>
    </article>
  );
}
