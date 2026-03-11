import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function getSessionIdFromQuery() {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("session_id")?.trim() || params.get("token")?.trim() || ""
  );
}

export default function PaymentCancelPage() {
  const stripeSessionId = getSessionIdFromQuery();

  const checkoutResultQuery = trpc.payments.getCheckoutResult.useQuery(
    { stripeSessionId },
    {
      enabled: stripeSessionId.length > 0,
      retry: 0,
    }
  );

  const retryMutation = trpc.payments.createCheckoutSessionForAppointment.useMutation({
    onSuccess: result => {
      if (typeof window !== "undefined") {
        window.location.href = result.checkoutSessionUrl;
      }
    },
    onError: error => {
      toast.error(error.message || "Failed to restart checkout.");
    },
  });

  const canRetry = Boolean(checkoutResultQuery.data?.appointmentId);

  return (
    <AppLayout title="Payment Canceled / 支付已取消">
      <div className="mx-auto max-w-2xl space-y-4 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Checkout canceled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You left the payment page before completion.</p>
            <p>支付尚未完成，你可以稍后继续支付。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Step</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard";
                }
              }}
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() =>
                canRetry &&
                retryMutation.mutate({
                  appointmentId: checkoutResultQuery.data!.appointmentId,
                })
              }
              disabled={!canRetry || retryMutation.isPending}
            >
              {retryMutation.isPending ? "Redirecting..." : "Continue Payment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
