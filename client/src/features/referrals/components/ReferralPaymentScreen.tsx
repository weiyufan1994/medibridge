import { toast } from "sonner";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getLocalizedText } from "@/lib/i18n";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  buildReferralOrderHref,
  formatReferralMoney,
  getReferralPaymentAction,
  getReferralUserErrorMessage,
  getReferralStatusLabel,
} from "@/features/referrals/presentation";

type ReferralPaymentScreenProps = {
  orderId: number;
  lang: ReferralLang;
};

export function ReferralPaymentScreen({
  orderId,
  lang,
}: ReferralPaymentScreenProps) {
  const [, setLocation] = useLocation();
  const copy = getReferralCopy(lang);
  const orderQuery = trpc.referrals.getOrderDetail.useQuery({ orderId });
  const createPaymentSessionMutation =
    trpc.referrals.createPaymentSession.useMutation({
      onSuccess: result => {
        if (typeof window !== "undefined") {
          window.location.href = result.checkoutSessionUrl;
        }
      },
      onError: error => {
        toast.error(
          getReferralUserErrorMessage(error, copy.payment.paymentFailed)
        );
      },
    });

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {orderQuery.error?.message || copy.payment.missingOrder}
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

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-2xl">{copy.payment.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.payment.description}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.payment.selectedHospital}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {hospitalName}
            </p>
            <p className="mt-1 text-sm text-slate-500">{departmentName}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.payment.selectedContact}
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

      <Card className="rounded-3xl border-slate-200/80">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {copy.payment.currentStatus}
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {getReferralStatusLabel(detail.order.status, lang)}
              </p>
            </div>
            <Badge className="border-0 bg-teal-600 text-white">
              {detail.order.paymentStatus}
            </Badge>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.payment.serviceFee}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatReferralMoney({
                amount: detail.order.totalAmount,
                currency: detail.order.currency,
                lang,
              })}
            </p>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            {copy.payment.payHelp}
          </p>

          {paymentAction ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
              {copy.orderDetail.pendingPaymentNotice}
            </div>
          ) : null}

          {detail.order.manualFulfillmentRequired ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {copy.confirmation.manualHandlingNotice}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {paymentAction && paymentActionLabel ? (
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
            ) : null}
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() => setLocation(buildReferralOrderHref(orderId))}
            >
              {copy.payment.viewOrder}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
