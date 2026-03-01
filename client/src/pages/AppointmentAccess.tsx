import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toDateTimeInputValue(value: Date | string | null): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AppointmentAccessPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/appointment/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();
  const validInput = Number.isInteger(appointmentId) && appointmentId > 0 && token.length >= 16;

  const queryInput = useMemo(
    () => ({
      appointmentId: validInput ? appointmentId : 1,
      token: validInput ? token : "invalid-token-000",
    }),
    [appointmentId, token, validInput]
  );

  const appointmentQuery = trpc.appointments.getByToken.useQuery(queryInput, {
    enabled: validInput,
    retry: 0,
  });

  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const utils = trpc.useUtils();
  const rescheduleMutation = trpc.appointments.rescheduleByToken.useMutation({
    onSuccess: async result => {
      setNewScheduledAt(toDateTimeInputValue(result.scheduledAt));
      await utils.appointments.getByToken.invalidate(queryInput);
      toast.success("Appointment rescheduled.");
    },
    onError: error => {
      toast.error(error.message || "Failed to reschedule appointment.");
    },
  });

  const resendMutation = trpc.appointments.resendLink.useMutation({
    onSuccess: async result => {
      if (result.devLink) {
        toast.success(`New link generated: ${result.devLink}`);
        const nextUrl = new URL(result.devLink);
        setLocation(`${nextUrl.pathname}${nextUrl.search}`);
      } else {
        toast.success("Magic link re-sent to email.");
      }
      await utils.appointments.getByToken.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Failed to resend link.");
    },
  });

  const handleJoin = async () => {
    try {
      setIsJoining(true);
      const result = await utils.appointments.joinInfoByToken.fetch({
        appointmentId,
        token,
      });
      if (typeof window !== "undefined") {
        window.location.href = result.joinUrl;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get join URL.");
    } finally {
      setIsJoining(false);
    }
  };

  if (!validInput) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invalid appointment link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Missing or invalid appointment id/token in URL.</p>
            <Link href="/triage">
              <Button variant="outline">Go to AI triage</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (appointmentQuery.isLoading) {
    return (
      <main className="mx-auto flex max-w-2xl items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    );
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Link unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>{appointmentQuery.error?.message || "Appointment not found."}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const appointment = appointmentQuery.data;
  const scheduledAt = toDate(appointment.scheduledAt);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Appointment Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Appointment ID: {appointment.id}</p>
          <p>Doctor ID: {appointment.doctorId}</p>
          <p>Type: {appointment.appointmentType}</p>
          <p>Status: {appointment.status}</p>
          <p>Email: {appointment.email}</p>
          <p>Session ID: {appointment.sessionId || "-"}</p>
          <p>Scheduled At: {scheduledAt ? scheduledAt.toLocaleString() : "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="datetime-local"
            value={newScheduledAt || toDateTimeInputValue(appointment.scheduledAt)}
            onChange={event => setNewScheduledAt(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!newScheduledAt) {
                  toast.error("Please choose a new date/time.");
                  return;
                }
                void rescheduleMutation.mutateAsync({
                  appointmentId,
                  token,
                  newScheduledAt: new Date(newScheduledAt).toISOString(),
                });
              }}
              disabled={rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void resendMutation.mutateAsync({
                  appointmentId,
                  email: appointment.email,
                })
              }
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? "Sending..." : "Resend Link"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleJoin()}
              disabled={isJoining}
            >
              {isJoining ? "Preparing..." : "Enter Visit Room"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
