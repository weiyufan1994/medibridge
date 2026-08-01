import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  formatReferralDateTime,
  formatReferralMoney,
  getReferralCheckoutRedirectHref,
  getLatestReferralProgressUpdate,
  getPatientVisibleReferralTimeline,
  buildReferralOrdersListHref,
  getReferralOrderDetailHelperNotice,
  getReferralPaymentAction,
  getReferralUserErrorMessage,
  getReferralStatusLabel,
  getRefundStatusLabel,
} from "@/features/referrals/presentation";
import { REFERRAL_FULFILLMENT_TIME_ZONE } from "@shared/referrals";

type ReferralOrderDetailScreenProps = {
  orderId: number;
  lang: ReferralLang;
};

export function ReferralOrderDetailScreen({
  orderId,
  lang,
}: ReferralOrderDetailScreenProps) {
  const [, setLocation] = useLocation();
  const copy = getReferralCopy(lang);
  const orderQuery = trpc.referrals.getOrderDetail.useQuery({ orderId });
  const createPaymentSessionMutation =
    trpc.referrals.createPaymentSession.useMutation({
      onSuccess: result => {
        if (typeof window !== "undefined") {
          window.location.href = getReferralCheckoutRedirectHref({
            orderId: result.orderId,
            checkoutSessionUrl: result.checkoutSessionUrl,
          });
        }
      },
      onError: error => {
        toast.error(
          getReferralUserErrorMessage(error, copy.payment.paymentFailed)
        );
      },
    });

  const latestUpdate = useMemo(
    () =>
      getLatestReferralProgressUpdate({
        operation: orderQuery.data?.operations[0] ?? null,
        lang,
        consultationTime: orderQuery.data?.order.consultationTime ?? null,
      }),
    [lang, orderQuery.data?.operations, orderQuery.data?.order.consultationTime]
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
  const paymentAction = getReferralPaymentAction({
    status: detail.order.status,
    paymentStatus: detail.order.paymentStatus,
  });
  const paymentActionLabel = paymentAction ? copy.payment[paymentAction] : null;
  const helperNotice = getReferralOrderDetailHelperNotice({
    status: detail.order.status,
    manualFulfillmentRequired: detail.order.manualFulfillmentRequired,
    consultationTime: detail.order.consultationTime,
    lang,
  });
  const timeline = getPatientVisibleReferralTimeline(detail.timeline);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader className="space-y-4">
          <Button
            variant="ghost"
            className="h-auto w-fit gap-2 px-0 text-sm text-slate-600 hover:bg-transparent hover:text-slate-900"
            onClick={() => setLocation(buildReferralOrdersListHref())}
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.navigation.backToOrders}
          </Button>
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                {copy.orderDetail.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {copy.orderDetail.orderId}: #{detail.order.id}
              </p>
            </div>
            <Badge className="border-0 bg-teal-600 text-white">
              {getReferralStatusLabel(detail.order.status, lang)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.orderDetail.selectedHospital}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {hospitalName}
            </p>
            <p className="mt-1 text-sm text-slate-500">{departmentName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.orderDetail.selectedContact}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {detail.contact?.name ?? copy.common.contactPending}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {detail.contact
                ? copy.selection.coordinatorRole
                : copy.selection.teamDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          {paymentAction && paymentActionLabel ? (
            <Card className="rounded-3xl border-teal-200 bg-teal-50/70">
              <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <p className="text-sm leading-6 text-teal-950">
                  {copy.orderDetail.pendingPaymentNotice}
                </p>
                <Button
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  disabled={createPaymentSessionMutation.isPending}
                  onClick={() => {
                    void createPaymentSessionMutation.mutateAsync({ orderId });
                  }}
                >
                  {createPaymentSessionMutation.isPending
                    ? copy.payment.paymentWaiting
                    : paymentActionLabel}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-3xl border-slate-200/80">
            <CardHeader>
              <CardTitle>{copy.orderDetail.latestUpdate}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p>{latestUpdate.text}</p>
                {latestUpdate.updatedAt ? (
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.latestUpdateTime}:{" "}
                    {formatReferralDateTime(latestUpdate.updatedAt, lang)}
                  </p>
                ) : null}
              </div>

              {helperNotice ? (
                <div
                  className={
                    helperNotice.tone === "success"
                      ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
                      : "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                  }
                >
                  {helperNotice.text}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.consultationTime}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatReferralDateTime(
                      detail.order.consultationTime,
                      lang
                    )}
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

              {detail.order.fulfillmentDeadlineAt ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {copy.orderDetail.fulfillmentDeadline}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatReferralDateTime(
                      detail.order.fulfillmentDeadlineAt,
                      lang,
                      REFERRAL_FULFILLMENT_TIME_ZONE
                    )}{" "}
                    ({REFERRAL_FULFILLMENT_TIME_ZONE})
                  </p>
                </div>
              ) : null}

              {detail.consultationArrangement ? (
                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {copy.orderDetail.consultationProvider}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.consultationArrangement.providerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {copy.orderDetail.consultationPlatform}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.consultationArrangement.platform}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {copy.orderDetail.consultationTime}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {formatReferralDateTime(
                          detail.consultationArrangement.scheduledAt,
                          lang,
                          detail.consultationArrangement.timeZone
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {copy.orderDetail.consultationTimeZone}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.consultationArrangement.timeZone}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {copy.orderDetail.consultationInstructions}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {detail.consultationArrangement.instructions}
                    </p>
                  </div>
                  <Button asChild className="rounded-xl bg-teal-600 text-white">
                    <a
                      href={detail.consultationArrangement.joinUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {copy.orderDetail.consultationJoinLink}
                    </a>
                  </Button>
                </div>
              ) : null}

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
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.orderDetail.noTimeline}
              </p>
            ) : (
              <div className="space-y-3">
                {timeline.map(event => (
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
