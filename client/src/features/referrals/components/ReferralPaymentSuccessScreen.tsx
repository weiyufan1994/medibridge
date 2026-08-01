import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  buildReferralOrderHref,
  getReferralStatusLabel,
} from "@/features/referrals/presentation";
import { trpc } from "@/lib/trpc";

type ReferralPaymentSuccessScreenProps = {
  orderId: number | null;
  paymentSessionId: string | null;
  lang: ReferralLang;
};

export function ReferralPaymentSuccessScreen({
  orderId,
  paymentSessionId,
  lang,
}: ReferralPaymentSuccessScreenProps) {
  const [, setLocation] = useLocation();
  const copy = getReferralCopy(lang);
  const confirmMutation =
    trpc.referrals.confirmReturnedPaymentSession.useMutation();

  useEffect(() => {
    if (!paymentSessionId) {
      return;
    }
    if (
      confirmMutation.isPending ||
      confirmMutation.data ||
      confirmMutation.error
    ) {
      return;
    }

    void confirmMutation.mutateAsync({
      paymentSessionId,
    });
  }, [confirmMutation, paymentSessionId]);

  if (!paymentSessionId) {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>{copy.payment.successTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{copy.payment.successMissingSession}</p>
          {orderId ? (
            <Button
              variant="outline"
              onClick={() => setLocation(buildReferralOrderHref(orderId))}
            >
              {copy.payment.viewOrder}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (confirmMutation.isPending) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.payment.processing}
        </CardContent>
      </Card>
    );
  }

  if (confirmMutation.error) {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>{copy.payment.successTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {confirmMutation.error.message || copy.payment.paymentReturnedError}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                void confirmMutation.mutateAsync({ paymentSessionId });
              }}
            >
              {copy.common.refresh}
            </Button>
            {orderId ? (
              <Button
                variant="outline"
                onClick={() => setLocation(buildReferralOrderHref(orderId))}
              >
                {copy.payment.viewOrder}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const resolvedOrderId = confirmMutation.data?.orderId ?? orderId;

  return (
    <Card className="rounded-3xl border-slate-200/80">
      <CardHeader>
        <CardTitle className="text-2xl">{copy.payment.successTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {copy.payment.successDescription}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          {confirmMutation.data
            ? `${copy.payment.currentStatus}: ${getReferralStatusLabel(
                confirmMutation.data.status,
                lang
              )}`
            : copy.payment.successDescription}
        </p>
        {resolvedOrderId ? (
          <Button
            className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => setLocation(buildReferralOrderHref(resolvedOrderId))}
          >
            {copy.payment.viewOrder}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
