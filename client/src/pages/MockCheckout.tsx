import { Loader2 } from "lucide-react";
import { useRoute } from "wouter";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function MockCheckoutPage() {
  const [, params] = useRoute<{ bookingId: string }>("/mock-checkout/:bookingId");
  const bookingId = Number(params?.bookingId ?? NaN);
  const validBookingId = Number.isInteger(bookingId) && bookingId > 0;
  const utils = trpc.useUtils();

  const simulatePaymentMutation = trpc.payments.confirmMockCheckoutByAppointment.useMutation({
    onSuccess: async result => {
      if (result.stripeSessionId) {
        await utils.payments.getCheckoutResult.invalidate({
          stripeSessionId: result.stripeSessionId,
        });
      }
      if (result.devPatientLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devPatientLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      if (result.stripeSessionId && typeof window !== "undefined") {
        window.location.href = `/payment/success?session_id=${encodeURIComponent(result.stripeSessionId)}`;
      }
    },
    onError: error => {
      toast.error(error.message || "Failed to simulate payment.");
    },
  });

  if (!validBookingId) {
    return (
      <AppLayout title="Mock Checkout">
        <div className="mx-auto max-w-2xl py-2">
          <Card>
            <CardHeader>
              <CardTitle>Invalid booking id</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mock Checkout">
      <div className="mx-auto max-w-2xl py-2">
        <Card>
          <CardHeader>
            <CardTitle>Mock Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Booking ID: {bookingId}</p>
            <p>This page simulates a full payment step during development testing.</p>
            <Button
              onClick={() =>
                void simulatePaymentMutation.mutateAsync({
                  appointmentId: bookingId,
                })
              }
              disabled={simulatePaymentMutation.isPending}
            >
              {simulatePaymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Simulate Payment"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
