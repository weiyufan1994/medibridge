import React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatChinaDateTime, formatLocalDateTime } from "@/lib/appointmentTime";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDashboardAppointmentCopy } from "@/features/dashboard/copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function toStatusBadgeVariant(status: MyAppointmentItem["status"]) {
  if (status === "ended") return "secondary" as const;
  if (status === "expired" || status === "refunded" || status === "canceled") {
    return "destructive" as const;
  }
  return "default" as const;
}

function getPrimaryAction(
  item: MyAppointmentItem,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (item.status === "pending_payment") {
    return { label: t.payNow, hint: t.hintPendingPayment };
  }
  if (item.status === "paid") {
    return { label: t.enterVisitRoom, hint: t.hintPaid };
  }
  if (item.status === "active") {
    return { label: t.enterVisitRoom, hint: t.hintActive };
  }
  if (item.status === "ended") {
    return { label: t.viewRecord, hint: t.hintEnded };
  }
  return { label: t.view, hint: t.hintInactive };
}

function AppointmentRow(props: {
  item: MyAppointmentItem;
  locale: string;
  t: ReturnType<typeof getDashboardAppointmentCopy>;
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
  const primaryAction = getPrimaryAction(props.item, props.t);

  return (
    <TableRow>
      <TableCell>{doctorName}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <p>{formatLocalDateTime(props.item.scheduledAt, props.locale)}</p>
          <p className="text-xs text-muted-foreground">
            {props.t.doctorTimeChina}: {formatChinaDateTime(props.item.scheduledAt, props.locale)}
          </p>
        </div>
      </TableCell>
      <TableCell>{toAppointmentTypeLabel(props.item.appointmentType, props.t)}</TableCell>
      <TableCell>
        <Badge variant={toStatusBadgeVariant(props.item.status)}>
          {toStatusLabel(props.item.status, props.t)}
        </Badge>
      </TableCell>
      <TableCell className="space-x-2">
        <Button
          type="button"
          size="sm"
          variant={props.item.status === "active" ? "default" : "outline"}
          onClick={() => {
            void props.onPrimaryAction(props.item);
          }}
          disabled={props.isActing}
        >
          {primaryAction.label}
        </Button>
        {(props.item.status === "paid" || props.item.status === "active") && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void props.onResend(props.item.id);
            }}
            disabled={props.isActing}
          >
            {props.t.resendLink}
          </Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{primaryAction.hint}</p>
      </TableCell>
    </TableRow>
  );
}

function AppointmentSection(props: {
  title: string;
  t: ReturnType<typeof getDashboardAppointmentCopy>;
  locale: string;
  items: MyAppointmentItem[];
  onPrimaryAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  actingAppointmentId: number | null;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{props.title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{props.t.tableDoctor}</TableHead>
            <TableHead>{props.t.tableTime}</TableHead>
            <TableHead>{props.t.tableType}</TableHead>
            <TableHead>{props.t.tableStatus}</TableHead>
            <TableHead>{props.t.tableActions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.length > 0 ? (
            props.items.map(item => (
              <AppointmentRow
                key={item.id}
                item={item}
                locale={props.locale}
                t={props.t}
                onPrimaryAction={props.onPrimaryAction}
                onResend={props.onResend}
                isActing={props.actingAppointmentId === item.id}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {props.t.emptySection}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

export function MyAppointments() {
  const [actingAppointmentId, setActingAppointmentId] =
    React.useState<number | null>(null);
  const { resolved } = useLanguage();
  const t = getDashboardAppointmentCopy(resolved);
  const locale = resolved === "zh" ? "zh-CN" : "en-US";
  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();
  const openRoomMutation = trpc.appointments.openMyRoom.useMutation();
  const retryPaymentMutation =
    trpc.payments.createCheckoutSessionForAppointment.useMutation();

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

      if (
        item.status === "paid" ||
        item.status === "active" ||
        item.status === "ended"
      ) {
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
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingAppointments}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <AppointmentSection
          title={t.sectionUpcoming}
          t={t}
          locale={locale}
          items={data.upcoming}
          onPrimaryAction={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
        <AppointmentSection
          title={t.sectionCompleted}
          t={t}
          locale={locale}
          items={data.completed}
          onPrimaryAction={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
        <AppointmentSection
          title={t.sectionPast}
          t={t}
          locale={locale}
          items={data.past}
          onPrimaryAction={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
      </CardContent>
    </Card>
  );
}
