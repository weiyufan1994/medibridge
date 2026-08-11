import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getDoctorWorkbenchAppointmentTypeLabel,
  getDoctorWorkbenchStatusLabel,
} from "../presentation";
import type {
  DoctorWorkbenchAppointmentDetail,
  DoctorWorkbenchLanguage,
  DoctorWorkbenchTranslate,
} from "../types";
import { DoctorWorkbenchAppointmentActions } from "./DoctorWorkbenchAppointmentActions";
import { DoctorWorkbenchAppointmentDetails } from "./DoctorWorkbenchAppointmentDetails";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: DoctorWorkbenchAppointmentDetail | null | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  locale: string;
  lang: DoctorWorkbenchLanguage;
  tr: DoctorWorkbenchTranslate;
  onStartConsultation: (appointmentId: number) => void;
  onOpenRoom: (appointmentId: number) => void;
  onCompleteAndSummarize: (appointmentId: number) => void;
  isStarting: boolean;
  isOpeningRoom: boolean;
  isCompleting: boolean;
};

export function DoctorWorkbenchAppointmentSheet(props: Props) {
  const { detail, tr } = props;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-slate-200 bg-[linear-gradient(180deg,#fffdf8_0%,#f8fafc_38%,#ffffff_100%)] p-0 sm:max-w-[760px]"
      >
        <SheetHeader className="border-b border-slate-200/80 bg-white/90 px-6 py-5 backdrop-blur">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-teal-600 text-white">
                {detail
                  ? getDoctorWorkbenchAppointmentTypeLabel(
                      detail.appointmentType,
                      props.lang
                    )
                  : tr("医生工作台", "Doctor Workbench")}
              </Badge>
              {detail ? (
                <Badge
                  variant="outline"
                  className="border-slate-300 bg-white text-slate-700"
                >
                  {getDoctorWorkbenchStatusLabel(detail.status, props.lang)}
                </Badge>
              ) : null}
              {detail?.hasSignedMedicalSummary ? (
                <Badge className="border-0 bg-emerald-100 text-emerald-700">
                  {tr("已签摘要", "Summary Signed")}
                </Badge>
              ) : null}
            </div>
            <SheetTitle className="text-2xl font-semibold tracking-tight text-slate-900">
              {detail
                ? tr(
                    `患者 ${detail.patient.email}`,
                    `Patient ${detail.patient.email}`
                  )
                : tr("预约详情", "Appointment Detail")}
            </SheetTitle>
            <SheetDescription className="max-w-2xl text-sm leading-6 text-slate-600">
              {tr(
                "在这里查看诊前资料、AI 分诊摘要、已签病历，并直接完成接诊相关操作。",
                "Review pre-visit intake, AI triage context, signed medical summaries, and complete doctor-side actions from one place."
              )}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          {props.isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
              <CalendarClock className="h-4 w-4 animate-pulse text-teal-600" />
              {tr("正在加载预约详情...", "Loading appointment detail...")}
            </div>
          ) : props.errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {props.errorMessage}
            </div>
          ) : !detail ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
              {tr(
                "请选择一条预约查看详情。",
                "Select an appointment to review its details."
              )}
            </div>
          ) : (
            <DoctorWorkbenchAppointmentDetails
              detail={detail}
              locale={props.locale}
              lang={props.lang}
              tr={tr}
            />
          )}
        </div>

        {detail ? (
          <DoctorWorkbenchAppointmentActions
            detail={detail}
            tr={tr}
            onStartConsultation={props.onStartConsultation}
            onOpenRoom={props.onOpenRoom}
            onCompleteAndSummarize={props.onCompleteAndSummarize}
            isStarting={props.isStarting}
            isOpeningRoom={props.isOpeningRoom}
            isCompleting={props.isCompleting}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
