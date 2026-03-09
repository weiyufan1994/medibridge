import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatAppointmentTimes } from "@/lib/appointmentTime";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDashboardAppointmentCopy } from "@/features/dashboard/copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type MyAppointmentItem = {
  id: number;
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status:
    | "draft"
    | "pending_payment"
    | "paid"
    | "active"
    | "ended"
    | "expired"
    | "refunded"
    | "canceled";
  paymentStatus:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | "canceled";
  createdAt: Date | string;
};

type AppointmentSectionVariant = "upcoming" | "completed";

function toAppointmentTypeLabel(
  type: MyAppointmentItem["appointmentType"],
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (type === "online_chat") return t.typeOnline;
  if (type === "video_call") return t.typeVideo;
  return t.typeInPerson;
}

function toStatusLabel(
  status: MyAppointmentItem["status"],
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (status === "draft") return t.statusDraft;
  if (status === "pending_payment") return t.statusPendingPayment;
  if (status === "paid") return t.statusPaid;
  if (status === "active") return t.statusActive;
  if (status === "ended") return t.statusEnded;
  if (status === "expired") return t.statusExpired;
  if (status === "refunded") return t.statusRefunded;
  return t.statusCanceled;
}

function getHint(
  item: MyAppointmentItem,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (item.status === "pending_payment") return t.hintPendingPayment;
  if (item.status === "paid") return t.hintPaid;
  if (item.status === "active") return t.hintActive;
  if (item.status === "ended") return t.hintEnded;
  return t.hintInactive;
}

function getStatusBadgeClass(variant: AppointmentSectionVariant, status: MyAppointmentItem["status"]) {
  if (status === "paid") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (variant === "upcoming") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (status === "ended") {
    return "rounded-full border-0 bg-emerald-100 text-emerald-700";
  }
  return "rounded-full border-0 bg-slate-100 text-slate-600";
}

function DoctorAvatar(props: { doctorName: string; imageUrl?: string | null }) {
  return (
    <Avatar className="h-10 w-10 border border-slate-100">
      <AvatarImage src={props.imageUrl ?? undefined} />
      <AvatarFallback className="bg-slate-100 text-slate-700">
        {props.doctorName.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function AppointmentCard(props: {
  item: MyAppointmentItem;
  t: ReturnType<typeof getDashboardAppointmentCopy>;
  section: AppointmentSectionVariant;
  onPrimaryAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  isActing: boolean;
}) {
  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: props.item.doctorId },
    {
      enabled: props.item.doctorId > 0,
      retry: 1,
    }
  );

  const doctorName =
    doctorQuery.data?.doctor?.nameEn ||
    doctorQuery.data?.doctor?.name ||
    props.t.doctorFallback.replace("{{id}}", String(props.item.doctorId));
  const doctorImage = doctorQuery.data?.doctor?.imageUrl;
  const timeDisplay = formatAppointmentTimes(props.item.scheduledAt);

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <DoctorAvatar doctorName={doctorName} imageUrl={doctorImage} />
          <div>
            <p className="text-base font-semibold text-slate-900">{doctorName}</p>
            <p className="text-sm text-slate-500">{toAppointmentTypeLabel(props.item.appointmentType, props.t)}</p>
          </div>
        </div>
        <Badge className={getStatusBadgeClass(props.section, props.item.status)}>
          {toStatusLabel(props.item.status, props.t)}
        </Badge>
      </div>

      <div className="px-5 pb-5">
        <div className="grid gap-3 rounded-lg border border-slate-100 bg-teal-50/30 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Local Time</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{timeDisplay.localTime}</p>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">China Time (China) 🇨🇳</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{timeDisplay.doctorTime}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-200/80" />

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-slate-500">{getHint(props.item, props.t)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {props.section === "upcoming" ? (
            <>
              <Button
                type="button"
                className="rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  void props.onPrimaryAction(props.item);
                }}
                disabled={props.isActing}
              >
                {props.t.enterVisitRoom}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50"
                onClick={() => {
                  void props.onResend(props.item.id);
                }}
                disabled={props.isActing}
              >
                {props.t.resendLink}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50"
              onClick={() => {
                void props.onPrimaryAction(props.item);
              }}
              disabled={props.isActing}
            >
              {props.t.viewRecord}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function AppointmentSection(props: {
  title: string;
  t: ReturnType<typeof getDashboardAppointmentCopy>;
  items: MyAppointmentItem[];
  section: AppointmentSectionVariant;
  onPrimaryAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  actingAppointmentId: number | null;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
      {props.items.length > 0 ? (
        <div className="space-y-3">
          {props.items.map(item => (
            <AppointmentCard
              key={item.id}
              item={item}
              t={props.t}
              section={props.section}
              onPrimaryAction={props.onPrimaryAction}
              onResend={props.onResend}
              isActing={props.actingAppointmentId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50 p-4 text-sm text-slate-500">
          {props.t.emptySection}
        </div>
      )}
    </section>
  );
}

export function MyAppointments() {
  const [actingAppointmentId, setActingAppointmentId] = React.useState<number | null>(null);
  const { resolved } = useLanguage();
  const t = getDashboardAppointmentCopy(resolved);
  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();
  const openRoomMutation = trpc.appointments.openMyRoom.useMutation();
  const retryPaymentMutation = trpc.payments.createCheckoutSessionForAppointment.useMutation();

  const handleOpenAccess = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      if (item.status === "pending_payment" || item.status === "draft") {
        const checkout = await retryPaymentMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = checkout.checkoutSessionUrl;
        }
        return;
      }

      if (item.status === "paid" || item.status === "active" || item.status === "ended") {
        const result = await openRoomMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = result.joinUrl;
        }
        return;
      }

      const result = await resendMutation.mutateAsync({ appointmentId: item.id });
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      toast.success(t.accessSentEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.actionFailed;
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleResend = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      await resendMutation.mutateAsync({ appointmentId });
      toast.success(t.accessSent);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.resendFailed;
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  if (query.isLoading) {
    return (
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingAppointments}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{query.error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const data = query.data ?? {
    upcoming: [],
    completed: [],
    past: [],
  };

  const completedItems = [...data.completed, ...data.past];

  return (
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <AppointmentSection
          title={t.sectionUpcoming}
          t={t}
          section="upcoming"
          items={data.upcoming}
          onPrimaryAction={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
        <AppointmentSection
          title={t.sectionCompleted}
          t={t}
          section="completed"
          items={completedItems}
          onPrimaryAction={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
      </CardContent>
    </Card>
  );
}
