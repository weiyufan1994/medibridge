import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAppointmentSurfaceText } from "@/features/appointment";
import { formatAppointmentTimes } from "@/lib/appointmentTime";
import { getDisplayLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  canEnterMyAppointmentRoomNow,
  getMyAppointmentHint,
  getMyAppointmentStatusBadgeClass,
  getMyAppointmentStatusLabel,
  getMyAppointmentTypeLabel,
  getMyAppointmentUpcomingActionLabel,
} from "../myAppointmentsPresentation";
import type {
  DashboardAppointmentCopy,
  MyAppointmentItem,
  MyAppointmentSectionVariant,
} from "../myAppointmentsPresentation";

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

function MyAppointmentCard(props: {
  item: MyAppointmentItem;
  copy: DashboardAppointmentCopy;
  resolved: "en" | "zh";
  section: MyAppointmentSectionVariant;
  onUpcomingAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  onViewMedicalSummary: (item: MyAppointmentItem) => Promise<void>;
  onViewChatHistory: (item: MyAppointmentItem) => Promise<void>;
  isActing: boolean;
}) {
  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: props.item.doctorId },
    {
      enabled: props.item.doctorId > 0,
      retry: 1,
    }
  );

  const doctorName = getAppointmentSurfaceText({
    lang: props.resolved,
    value: doctorQuery.data?.doctor?.name,
    fallback: props.copy.doctorFallback.replace(
      "{{id}}",
      String(props.item.doctorId)
    ),
  });
  const doctorImage = doctorQuery.data?.doctor?.imageUrl;
  const locale = getDisplayLocale(props.resolved);
  const timeDisplay = formatAppointmentTimes(
    props.item.scheduledAt,
    "-",
    locale
  );
  const isScheduleLocked = !canEnterMyAppointmentRoomNow(props.item);
  const actionLabel = getMyAppointmentUpcomingActionLabel(
    props.item,
    props.copy
  );

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <DoctorAvatar doctorName={doctorName} imageUrl={doctorImage} />
          <div>
            <p className="text-base font-semibold text-slate-900">
              {doctorName}
            </p>
            <p className="text-sm text-slate-500">
              {getMyAppointmentTypeLabel(
                props.item.appointmentType,
                props.copy
              )}
            </p>
          </div>
        </div>
        <Badge
          className={getMyAppointmentStatusBadgeClass(
            props.section,
            props.item
          )}
        >
          {getMyAppointmentStatusLabel(props.item, props.copy)}
        </Badge>
      </div>

      <div className="px-5 pb-5">
        <div className="grid gap-3 rounded-lg border border-slate-100 bg-teal-50/30 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {props.copy.localTimeLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {timeDisplay.localTime}
            </p>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {props.copy.chinaTimeLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {timeDisplay.doctorTime}
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-200/80" />

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-slate-500">
          {getMyAppointmentHint(props.item, props.copy)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {props.section === "upcoming" ? (
            <>
              <Button
                type="button"
                className="h-11 rounded-lg bg-teal-600 px-4 text-white hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onUpcomingAction(props.item);
                }}
                disabled={props.isActing || isScheduleLocked}
              >
                {actionLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg border-teal-200 px-4 text-teal-700 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onResend(props.item.id);
                }}
                disabled={props.isActing}
              >
                {props.copy.resendLink}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="h-11 rounded-lg bg-teal-600 px-4 text-white hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onViewMedicalSummary(props.item);
                }}
                disabled={props.isActing}
              >
                {props.copy.viewMedicalSummary}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg border-teal-200 px-4 text-teal-700 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onViewChatHistory(props.item);
                }}
                disabled={props.isActing}
              >
                {props.copy.viewChatHistory}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function MyAppointmentsList(props: {
  copy: DashboardAppointmentCopy;
  resolved: "en" | "zh";
  items: MyAppointmentItem[];
  section: MyAppointmentSectionVariant;
  onUpcomingAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  onViewMedicalSummary: (item: MyAppointmentItem) => Promise<void>;
  onViewChatHistory: (item: MyAppointmentItem) => Promise<void>;
  actingAppointmentId: number | null;
  tabLabel: string;
}) {
  return (
    <section aria-label={props.tabLabel} className="space-y-3">
      {props.items.length > 0 ? (
        <div className="space-y-3">
          {props.items.map(item => (
            <MyAppointmentCard
              key={item.id}
              item={item}
              copy={props.copy}
              resolved={props.resolved}
              section={props.section}
              onUpcomingAction={props.onUpcomingAction}
              onResend={props.onResend}
              onViewMedicalSummary={props.onViewMedicalSummary}
              onViewChatHistory={props.onViewChatHistory}
              isActing={props.actingAppointmentId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50 p-4 text-sm text-slate-500">
          {props.copy.emptySection}
        </div>
      )}
    </section>
  );
}
