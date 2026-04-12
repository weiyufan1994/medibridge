import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getReferralCopy } from "@/features/referrals/copy";
import {
  buildReferralOrderHref,
  buildReferralPaymentCancelHref,
  buildReferralPaymentSuccessHref,
  isReferralMockCheckoutEnabled,
  parsePositiveNumberParam,
} from "@/features/referrals/presentation";
import { trpc } from "@/lib/trpc";

export default function ReferralMockCheckoutPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ orderId: string }>("/referrals/mock-checkout/:orderId");
  const orderId = parsePositiveNumberParam(params?.orderId);
  const mockCheckoutEnabled = isReferralMockCheckoutEnabled();

  const confirmMockPaymentMutation = trpc.referrals.confirmMockPayment.useMutation({
    onSuccess: result => {
      if (typeof window !== "undefined") {
        window.location.href = buildReferralPaymentSuccessHref({
          orderId: result.orderId,
          paymentSessionId: result.paymentSessionId,
        });
      }
    },
    onError: error => {
      toast.error(error.message || copy.payment.paymentFailed);
    },
  });

  if (!orderId) {
    return (
      <AppLayout title={copy.payment.mockTitle}>
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>{copy.payment.mockTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {copy.payment.missingOrder}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!mockCheckoutEnabled) {
    return (
      <AppLayout title={copy.payment.mockTitle}>
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
          <Card className="rounded-3xl border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-2xl">{copy.payment.mockTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {copy.payment.mockDisabled}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200/80">
            <CardContent className="flex flex-wrap gap-3 p-6">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200"
                onClick={() => setLocation(buildReferralOrderHref(orderId))}
              >
                {copy.payment.viewOrder}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/dashboard")}
              >
                {copy.navigation.backToDashboard}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={copy.payment.mockTitle}>
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <Card className="rounded-3xl border-slate-200/80">
          <CardHeader>
            <CardTitle className="text-2xl">{copy.payment.mockTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{copy.payment.mockDescription}</p>
            <p>
              {copy.payment.mockOrderLabel}: #{orderId}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/80">
          <CardContent className="flex flex-wrap gap-3 p-6">
            <Button
              className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
              onClick={() => {
                void confirmMockPaymentMutation.mutateAsync({ orderId });
              }}
              disabled={confirmMockPaymentMutation.isPending}
            >
              {confirmMockPaymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {copy.payment.processing}
                </>
              ) : (
                copy.payment.mockSuccess
              )}
            </Button>

            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() =>
                setLocation(
                  buildReferralPaymentCancelHref({
                    orderId,
                  })
                )
              }
              disabled={confirmMockPaymentMutation.isPending}
            >
              {copy.payment.mockCancel}
            </Button>

            <Button
              variant="outline"
              className="rounded-xl border-slate-200"
              onClick={() => setLocation(buildReferralOrderHref(orderId))}
              disabled={confirmMockPaymentMutation.isPending}
            >
              {copy.payment.viewOrder}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
