import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  getReferralCheckoutRedirectHref,
  buildReferralOrderHref,
  getReferralUserErrorMessage,
} from "@/features/referrals/presentation";
import { trpc } from "@/lib/trpc";

type ReferralPaymentCancelScreenProps = {
  orderId: number | null;
  lang: ReferralLang;
};

export function ReferralPaymentCancelScreen({
  orderId,
  lang,
}: ReferralPaymentCancelScreenProps) {
  const [, setLocation] = useLocation();
  const copy = getReferralCopy(lang);
  const retryPaymentMutation = trpc.referrals.createPaymentSession.useMutation({
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

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-2xl">{copy.payment.cancelTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {copy.payment.cancelDescription}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <CardTitle>{copy.navigation.backToOrder}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
            {copy.navigation.backToDashboard}
          </Button>
          {orderId ? (
            <>
              <Button
                variant="outline"
                className="rounded-xl border-slate-200"
                onClick={() => setLocation(buildReferralOrderHref(orderId))}
              >
                {copy.payment.viewOrder}
              </Button>
              <Button
                className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                disabled={retryPaymentMutation.isPending}
                onClick={() => {
                  void retryPaymentMutation.mutateAsync({ orderId });
                }}
              >
                {retryPaymentMutation.isPending
                  ? copy.payment.paymentWaiting
                  : copy.payment.continuePayment}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              disabled
            >
              {copy.payment.continuePayment}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
