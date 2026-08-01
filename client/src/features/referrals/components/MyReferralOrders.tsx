import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getReferralCopy } from "@/features/referrals/copy";
import {
  buildReferralOrderHref,
  formatReferralDateTime,
  getReferralStatusLabel,
} from "@/features/referrals/presentation";

export function MyReferralOrders() {
  const [, setLocation] = useLocation();
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const ordersQuery = trpc.referrals.listMine.useQuery({ limit: 20 });

  return (
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{copy.dashboard.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ordersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.common.loading}
          </div>
        ) : ordersQuery.data && ordersQuery.data.length > 0 ? (
          ordersQuery.data.map(order => {
            const hospitalName =
              getLocalizedText({ lang, value: order.hospital.name }).trim() ||
              copy.common.notAvailable;
            const departmentName =
              getLocalizedText({ lang, value: order.department.name }).trim() ||
              copy.common.notAvailable;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-slate-900">
                      {hospitalName}
                    </p>
                    <p className="text-sm text-slate-500">{departmentName}</p>
                    <p className="text-sm text-slate-500">
                      {order.contact?.name ?? copy.common.contactPending}
                    </p>
                  </div>
                  <Badge className="border-0 bg-teal-600 text-white">
                    {getReferralStatusLabel(order.status, lang)}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {copy.dashboard.latestStatus}
                    </p>
                    <p className="mt-1">
                      {getReferralStatusLabel(order.status, lang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {copy.dashboard.consultationTime}
                    </p>
                    <p className="mt-1">
                      {formatReferralDateTime(order.consultationTime, lang)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={() =>
                      setLocation(buildReferralOrderHref(order.id))
                    }
                  >
                    {copy.dashboard.viewOrder}
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{copy.dashboard.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
