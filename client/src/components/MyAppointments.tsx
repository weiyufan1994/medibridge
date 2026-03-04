import React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatChinaDateTime, formatLocalDateTime } from "@/lib/appointmentTime";
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
    | "confirmed"
    | "in_session"
    | "completed"
    | "expired"
    | "refunded";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refunded";
  createdAt: Date | string;
};

function toAppointmentTypeLabel(type: MyAppointmentItem["appointmentType"]) {
  if (type === "online_chat") return "Online chat";
  if (type === "video_call") return "Video call";
  return "In person";
}

function toStatusLabel(status: MyAppointmentItem["status"]) {
  return status.replaceAll("_", " ");
}

function toStatusBadgeVariant(status: MyAppointmentItem["status"]) {
  if (status === "completed") return "secondary" as const;
  if (status === "expired" || status === "refunded") return "destructive" as const;
  return "default" as const;
}

function AppointmentRow(props: {
  item: MyAppointmentItem;
  onView: (appointmentId: number) => Promise<void>;
  onEnter: (appointmentId: number) => Promise<void>;
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
    `Doctor #${props.item.doctorId}`;

  return (
    <TableRow>
      <TableCell>{doctorName}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <p>{formatLocalDateTime(props.item.scheduledAt)}</p>
          <p className="text-xs text-muted-foreground">
            Doctor time (China): {formatChinaDateTime(props.item.scheduledAt)}
          </p>
        </div>
      </TableCell>
      <TableCell>{toAppointmentTypeLabel(props.item.appointmentType)}</TableCell>
      <TableCell>
        <Badge variant={toStatusBadgeVariant(props.item.status)}>
          {toStatusLabel(props.item.status)}
        </Badge>
      </TableCell>
      <TableCell className="space-x-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void props.onView(props.item.id);
          }}
          disabled={props.isActing}
        >
          View
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void props.onEnter(props.item.id);
          }}
          disabled={props.isActing}
        >
          Enter Visit Room
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            void props.onResend(props.item.id);
          }}
          disabled={props.isActing}
        >
          Resend Link
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AppointmentSection(props: {
  title: string;
  items: MyAppointmentItem[];
  onView: (appointmentId: number) => Promise<void>;
  onEnter: (appointmentId: number) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  actingAppointmentId: number | null;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{props.title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Doctor</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.length > 0 ? (
            props.items.map(item => (
              <AppointmentRow
                key={item.id}
                item={item}
                onView={props.onView}
                onEnter={props.onEnter}
                onResend={props.onResend}
                isActing={props.actingAppointmentId === item.id}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No appointments in this section.
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
  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();

  const handleOpenAccess = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      const result = await resendMutation.mutateAsync({ appointmentId });
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }

      toast.success("Access link sent to your email.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open visit room.";
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleResend = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      await resendMutation.mutateAsync({ appointmentId });
      toast.success("Access link sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend link.";
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading appointments...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Appointments</CardTitle>
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
        <CardTitle>My Appointments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <AppointmentSection
          title="Upcoming"
          items={data.upcoming}
          onView={handleOpenAccess}
          onEnter={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
        <AppointmentSection
          title="Completed"
          items={data.completed}
          onView={handleOpenAccess}
          onEnter={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
        <AppointmentSection
          title="Past"
          items={data.past}
          onView={handleOpenAccess}
          onEnter={handleOpenAccess}
          onResend={handleResend}
          actingAppointmentId={actingAppointmentId}
        />
      </CardContent>
    </Card>
  );
}
