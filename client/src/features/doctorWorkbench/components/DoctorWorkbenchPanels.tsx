import {
  Calendar,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  Loader2,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  countSignedDoctorWorkbenchAppointments,
  formatDoctorWorkbenchDateTime,
  getDoctorWorkbenchAppointmentTypeLabel,
  getDoctorWorkbenchStatusLabel,
  maskDoctorWorkbenchEmail,
} from "../presentation";
import type {
  DoctorWorkbenchItem,
  DoctorWorkbenchLanguage,
  DoctorWorkbenchSlot,
  DoctorWorkbenchTranslate,
} from "../types";

export function DoctorWorkbenchOverview(props: {
  showLegacyRouteNotice: boolean;
  doctorName: string;
  doctor: { id: number; departmentId: number } | null;
  upcomingCount: number;
  slotsCount: number;
  appointments: DoctorWorkbenchItem[];
  tr: DoctorWorkbenchTranslate;
}) {
  return (
    <>
      {props.showLegacyRouteNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {props.tr(
            "这是兼容旧 doctorId 路由的入口。正式入口已经切换到 /doctor/workbench。",
            "This page is serving a legacy doctorId route. The canonical workbench entry is now /doctor/workbench."
          )}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.35fr,0.65fr]">
        <Card className="overflow-hidden border-slate-200/80 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              {props.doctorName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              {props.tr(
                "工作台现在支持查看诊前资料、AI 分诊摘要、快速开始接诊，以及从这里直接结束问诊并签发病历摘要。",
                "The workbench now supports pre-visit context review, AI triage summary, quick consultation start, and ending the visit with summary signing directly from here."
              )}
            </p>
            {props.doctor ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge
                  variant="outline"
                  className="border-slate-300 bg-white text-slate-700"
                >
                  {props.tr("科室", "Department")} #{props.doctor.departmentId}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-300 bg-white text-slate-700"
                >
                  ID #{props.doctor.id}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {props.tr("未来预约", "Upcoming Visits")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {props.upcomingCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {props.tr("未来 Slots", "Future Slots")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {props.slotsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {props.tr("已签摘要", "Signed Summaries")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {countSignedDoctorWorkbenchAppointments(props.appointments)}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

export function DoctorWorkbenchAppointmentsPanel(props: {
  items: DoctorWorkbenchItem[];
  isLoading: boolean;
  errorMessage: string | null;
  locale: string;
  lang: DoctorWorkbenchLanguage;
  tr: DoctorWorkbenchTranslate;
  isStarting: boolean;
  isOpeningRoom: boolean;
  onOpenDetail: (appointmentId: number) => void;
  onStartConsultation: (appointmentId: number) => void;
  onOpenRoom: (appointmentId: number) => void;
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>
          {props.tr("待接诊与近期预约", "Upcoming and Recent Appointments")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {props.tr("正在加载预约...", "Loading appointments...")}
          </div>
        ) : props.errorMessage ? (
          <p className="text-sm text-destructive">{props.errorMessage}</p>
        ) : (
          <>
            {props.items.map(item => (
              <div
                key={item.id}
                className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-slate-900 text-white">
                        {getDoctorWorkbenchAppointmentTypeLabel(
                          item.appointmentType,
                          props.lang
                        )}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-700"
                      >
                        {getDoctorWorkbenchStatusLabel(item.status, props.lang)}
                      </Badge>
                      {item.packageId ? (
                        <Badge
                          variant="outline"
                          className="border-slate-300 bg-white text-slate-700"
                        >
                          {item.packageId}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDoctorWorkbenchDateTime(
                        item.scheduledAt,
                        props.locale
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {maskDoctorWorkbenchEmail(item.patientEmail)} ·{" "}
                      {item.paymentStatus}
                    </p>
                    <p className="line-clamp-2 text-sm text-slate-700">
                      {item.chiefComplaint ||
                        props.tr("主诉待补充", "Chief complaint pending")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => props.onOpenDetail(item.id)}
                    >
                      <FileSearch className="mr-1.5 h-4 w-4" />
                      {props.tr("查看资料", "Review Context")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={item.status !== "paid" || props.isStarting}
                      onClick={() => props.onStartConsultation(item.id)}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      {props.tr("开始接诊", "Start")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !["paid", "active", "ended", "completed"].includes(
                          item.status
                        ) || props.isOpeningRoom
                      }
                      onClick={() => props.onOpenRoom(item.id)}
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      {props.tr("进入房间", "Open Room")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {props.items.length === 0 ? (
              <p className="text-sm text-slate-500">
                {props.tr("当前没有可显示的预约。", "No appointments to show.")}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DoctorWorkbenchSlotsPanel(props: {
  slots: DoctorWorkbenchSlot[];
  isLoading: boolean;
  errorMessage: string | null;
  locale: string;
  tr: DoctorWorkbenchTranslate;
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>
          {props.tr("未来可售 Slots", "Future Sellable Slots")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {props.tr("正在加载 slots...", "Loading slots...")}
          </div>
        ) : props.errorMessage ? (
          <p className="text-sm text-destructive">{props.errorMessage}</p>
        ) : (
          <>
            {props.slots.map(slot => (
              <div
                key={slot.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Calendar className="h-4 w-4 text-teal-600" />
                      {formatDoctorWorkbenchDateTime(
                        slot.startAt,
                        props.locale
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {slot.slotDurationMinutes} min · {slot.appointmentType} ·{" "}
                      {slot.status}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
            {props.slots.length === 0 ? (
              <p className="text-sm text-slate-500">
                {props.tr("当前没有未来 slots。", "No future slots yet.")}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
