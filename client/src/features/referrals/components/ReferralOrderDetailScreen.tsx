import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  formatReferralDateTime,
  formatReferralMoney,
  getReferralOperationLabel,
  getReferralStatusLabel,
  getRefundStatusLabel,
} from "@/features/referrals/presentation";

type ReferralOrderDetailScreenProps = {
  orderId: number;
  lang: ReferralLang;
};

function extractLatestUpdate(input: {
  operation: {
    actionType: string;
    actionPayload: unknown;
  } | null;
  lang: ReferralLang;
}) {
  const copy = getReferralCopy(input.lang);
  if (!input.operation) {
    return copy.orderDetail.latestUpdateFallback;
  }

  const payload =
    input.operation.actionPayload &&
    typeof input.operation.actionPayload === "object"
      ? (input.operation.actionPayload as Record<string, unknown>)
      : null;

  if (
    input.operation.actionType === "patient_notification" &&
    typeof payload?.detail === "string" &&
    payload.detail.trim().length > 0
  ) {
    return payload.detail;
  }

  if (
    (input.operation.actionType === "consultation_time_confirmed" ||
      input.operation.actionType === "consultation_time_updated") &&
    typeof payload?.consultationTime === "string"
  ) {
    return `${getReferralOperationLabel(
      input.operation.actionType,
      input.lang
    )}: ${formatReferralDateTime(payload.consultationTime, input.lang)}`;
  }

  return getReferralOperationLabel(input.operation.actionType, input.lang);
}

export function ReferralOrderDetailScreen({
  orderId,
  lang,
}: ReferralOrderDetailScreenProps) {
  const copy = getReferralCopy(lang);
  const orderQuery = trpc.referrals.getOrderDetail.useQuery({ orderId });

  const latestUpdate = useMemo(
    () =>
      extractLatestUpdate({
        operation: orderQuery.data?.operations[0] ?? null,
        lang,
      }),
    [lang, orderQuery.data?.operations]
  );

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {orderQuery.error?.message || copy.orderDetail.loadFailed}
        </CardContent>
      </Card>
    );
  }

  const detail = orderQuery.data;
  const hospitalName =
    getLocalizedText({ lang, value: detail.hospital.name }).trim() ||
    copy.common.notAvailable;
  const departmentName =
    getLocalizedText({ lang, value: detail.department.name }).trim() ||
    copy.common.notAvailable;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">{copy.orderDetail.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {copy.orderDetail.orderId}: #{detail.order.id}
            </p>
          </div>
          <Badge className="border-0 bg-teal-600 text-white">
            {getReferralStatusLabel(detail.order.status, lang)}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.orderDetail.selectedHospital}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {hospitalName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {departmentName}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.orderDetail.selectedContact}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {detail.contact?.name ?? copy.common.contactPending}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {detail.contact?.roleType ?? copy.confirmation.fulfillmentDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200/80">
            <CardHeader>
              <CardTitle>{copy.orderDetail.latestUpdate}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {latestUpdate}
              </div>

              {detail.order.manualFulfillmentRequired ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {copy.orderDetail.manualFulfillmentNotice}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.consultationTime}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatReferralDateTime(detail.order.consultationTime, lang)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.refundStatus}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detail.refundRequest
                      ? getRefundStatusLabel(detail.refundRequest.status, lang)
                      : copy.common.notAvailable}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {copy.orderDetail.serviceFee}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {formatReferralMoney({
                    amount: detail.order.totalAmount,
                    currency: detail.order.currency,
                    lang,
                  })}
                </p>
              </div>

              {detail.recommendationReason ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.recommendationReason}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detail.recommendationReason}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/80">
            <CardHeader>
              <CardTitle>{copy.orderDetail.triageSummary}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {detail.triageSummary || copy.common.notAvailable}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-200/80">
          <CardHeader>
            <CardTitle>{copy.orderDetail.timeline}</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.orderDetail.noTimeline}
              </p>
            ) : (
              <div className="space-y-3">
                {detail.timeline.map(event => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {getReferralStatusLabel(event.toStatus, lang)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatReferralDateTime(event.createdAt, lang)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
