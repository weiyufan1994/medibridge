import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

function getSessionIdFromQuery() {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("session_id")?.trim() || params.get("token")?.trim() || ""
  );
}

function isMockPaidQueryEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("mockPaid") === "1";
}

function getDisplayPaymentState(paymentStatus: string) {
  if (paymentStatus === "paid") {
    return { label: "Paid", variant: "default" as const };
  }
  if (paymentStatus === "refunded") {
    return { label: "Refunded", variant: "secondary" as const };
  }
  if (paymentStatus === "failed" || paymentStatus === "expired") {
    return { label: "Failed", variant: "destructive" as const };
  }
  return { label: "Pending", variant: "outline" as const };
}

export default function PaymentSuccessPage() {
  const stripeSessionId = getSessionIdFromQuery();
  const mockPaid = isMockPaidQueryEnabled();
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const checkoutResultQuery = trpc.payments.getCheckoutResult.useQuery(
    { stripeSessionId },
    {
      enabled: stripeSessionId.length > 0,
      retry: 0,
    }
  );
  const utils = trpc.useUtils();

  const confirmMockCheckoutMutation = trpc.payments.confirmMockCheckout.useMutation({
    onSuccess: async () => {
      await utils.payments.getCheckoutResult.invalidate({ stripeSessionId });
    },
    onError: error => {
      toast.error(error.message || "Failed to confirm payment.");
    },
  });

  const resendMutation = trpc.appointments.resendLink.useMutation({
    onSuccess: result => {
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      toast.success("Access link has been sent to your email.");
    },
    onError: error => {
      toast.error(error.message || "Failed to resend access link.");
    },
  });
  const retryPaymentMutation = trpc.payments.createCheckoutSessionForAppointment.useMutation({
    onSuccess: result => {
      if (typeof window !== "undefined") {
        window.location.href = result.checkoutSessionUrl;
      }
    },
    onError: error => {
      toast.error(error.message || "Failed to restart checkout.");
    },
  });

  const isTerminalStatus = useMemo(() => {
    const status = checkoutResultQuery.data?.paymentStatus;
    return status === "paid" || status === "failed" || status === "expired" || status === "refunded";
  }, [checkoutResultQuery.data?.paymentStatus]);

  useEffect(() => {
    if (!mockPaid) {
      return;
    }
    if (!checkoutResultQuery.data) {
      return;
    }
    if (checkoutResultQuery.data.paymentStatus === "paid") {
      return;
    }
    if (confirmMockCheckoutMutation.isPending || confirmMockCheckoutMutation.isSuccess) {
      return;
    }

    void confirmMockCheckoutMutation.mutateAsync({
      stripeSessionId,
    });
  }, [
    mockPaid,
    stripeSessionId,
    checkoutResultQuery.data,
    confirmMockCheckoutMutation,
  ]);

  useEffect(() => {
    if (stripeSessionId.length === 0 || !checkoutResultQuery.data) {
      return;
    }
    if (isTerminalStatus || pollTimedOut) {
      return;
    }

    const timer = window.setInterval(() => {
      void checkoutResultQuery.refetch();

      const elapsedMs = Date.now() - startedAtRef.current;
      if (elapsedMs >= 2 * 60 * 1000) {
        setPollTimedOut(true);
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [
    checkoutResultQuery.refetch,
    checkoutResultQuery.data,
    isTerminalStatus,
    pollTimedOut,
    stripeSessionId,
  ]);

  if (stripeSessionId.length === 0) {
    return (
      <AppLayout title="Payment Result / 支付结果">
        <div className="mx-auto max-w-2xl py-2">
          <Card>
            <CardHeader>
              <CardTitle>Missing payment session</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              session_id is required.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (checkoutResultQuery.isLoading) {
    return (
      <AppLayout title="Payment Result / 支付结果">
        <div className="mx-auto flex max-w-2xl items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (checkoutResultQuery.error || !checkoutResultQuery.data) {
    return (
      <AppLayout title="Payment Result / 支付结果">
        <div className="mx-auto max-w-2xl py-2">
          <Card>
            <CardHeader>
              <CardTitle>Unable to load payment result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{checkoutResultQuery.error?.message || "Unknown error."}</p>
              <Button
                variant="outline"
                onClick={() => void checkoutResultQuery.refetch()}
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const summary = checkoutResultQuery.data;
  const paymentState = getDisplayPaymentState(summary.paymentStatus);

  return (
    <AppLayout title="Payment Result / 支付结果">
      <div className="mx-auto max-w-2xl space-y-4 py-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Payment Status</CardTitle>
            <Badge variant={paymentState.variant}>{paymentState.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Appointment ID: {summary.appointmentId}</p>
            <p>{summary.messageForUser}</p>
            {summary.paymentStatus === "paid" ? (
              <p>访问链接已发送到邮箱 {summary.email}</p>
            ) : (
              <p>
                {pollTimedOut
                  ? "支付结果确认超时，请手动刷新或重新发起支付。"
                  : "仍在处理中，系统会自动刷新。"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Step</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void checkoutResultQuery.refetch()}
                disabled={checkoutResultQuery.isFetching}
              >
                {checkoutResultQuery.isFetching ? "Refreshing..." : "Refresh"}
              </Button>
              {(summary.paymentStatus === "pending" ||
                summary.paymentStatus === "failed" ||
                summary.paymentStatus === "expired") && (
                <Button
                  onClick={() =>
                    void retryPaymentMutation.mutateAsync({
                      appointmentId: summary.appointmentId,
                    })
                  }
                  disabled={retryPaymentMutation.isPending}
                >
                  {retryPaymentMutation.isPending
                    ? "Redirecting..."
                    : "Retry Payment"}
                </Button>
              )}
              {summary.canResendLink ? (
                <Button
                  onClick={() =>
                    void resendMutation.mutateAsync({
                      appointmentId: summary.appointmentId,
                    })
                  }
                  disabled={resendMutation.isPending}
                >
                  {resendMutation.isPending
                    ? "Opening..."
                    : "Enter Visit Room"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
