import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";

export function VisitRoomInvalidState(input: {
  title: string;
  message: string;
}) {
  return (
    <AppLayout title={input.title} isVisitRoom>
      <div className="mx-auto max-w-3xl py-4">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          {input.message}
        </Card>
      </div>
    </AppLayout>
  );
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
}) {
  return (
    <AppLayout title={input.title} isVisitRoom>
      <div className="mx-auto max-w-3xl py-4">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          {input.message}
        </Card>
      </div>
    </AppLayout>
  );
}
