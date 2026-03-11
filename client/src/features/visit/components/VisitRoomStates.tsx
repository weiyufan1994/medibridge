import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";

function VisitRoomCenteredNotice(input: {
  title: string;
  message: string;
  backToAppointmentsText: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <AppLayout title={input.title} isVisitRoom>
      <div className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(13,148,136,0.08),transparent_38%),radial-gradient(circle_at_80%_85%,rgba(14,116,144,0.07),transparent_34%)]" />

        <Card className="relative z-10 w-full max-w-[520px] rounded-3xl border-slate-200/80 bg-white/95 p-7 text-center shadow-lg backdrop-blur-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>

          <p className="mx-auto max-w-[36ch] text-base leading-7 text-slate-700">
            {input.message}
          </p>

          <Button
            type="button"
            className="mx-auto mt-6 inline-flex h-11 min-w-[176px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 text-white hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            onClick={() => setLocation("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {input.backToAppointmentsText}
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}

export function VisitRoomInvalidState(input: {
  title: string;
  message: string;
  backToAppointmentsText: string;
}) {
  return <VisitRoomCenteredNotice {...input} />;
}

export function VisitRoomLoadingState(input: {
  title: string;
}) {
  return (
    <AppLayout title={input.title} isVisitRoom>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    </AppLayout>
  );
}

export function VisitRoomErrorState(input: {
  title: string;
  message: string;
  backToAppointmentsText: string;
}) {
  return <VisitRoomCenteredNotice {...input} />;
}
