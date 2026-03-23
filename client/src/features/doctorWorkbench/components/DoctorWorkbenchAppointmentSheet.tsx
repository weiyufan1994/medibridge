import { CalendarClock, ClipboardList, FileText, HeartPulse, Sparkles, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAppointmentTimes } from "@/lib/appointmentTime";

type TranslateFn = (zh: string, en: string) => string;

type AppointmentIntake = {
  chiefComplaint?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  allergies?: string;
  ageGroup?: string;
  otherSymptoms?: string;
} | null;

type MedicalSummary = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  source: string;
  signedBy: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
} | null;

type AppointmentDetail = {
  id: number;
  slotId: number | null;
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  paidAt: Date | string | null;
  email: string;
  sessionId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastAccessAt: Date | string | null;
  patient: {
    email: string;
    sessionId: string | null;
  };
  triageSummary: string | null;
  intake: AppointmentIntake;
  medicalSummary: MedicalSummary;
  packageId: string | null;
  consultationDurationMinutes: number;
  consultationExtensionMinutes: number;
  consultationTotalMinutes: number;
  canStartConsultation: boolean;
  canOpenRoom: boolean;
  canCompleteConsultation: boolean;
  hasSignedMedicalSummary: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AppointmentDetail | null | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  locale: string;
  tr: TranslateFn;
  onStartConsultation: (appointmentId: number) => void;
  onOpenRoom: (appointmentId: number) => void;
  onCompleteAndSummarize: (appointmentId: number) => void;
  isStarting: boolean;
  isOpeningRoom: boolean;
  isCompleting: boolean;
};

function statusLabel(status: string, tr: TranslateFn) {
  switch (status) {
    case "pending_payment":
      return tr("待支付", "Pending Payment");
    case "paid":
      return tr("待接诊", "Ready");
    case "active":
      return tr("进行中", "In Progress");
    case "ended":
      return tr("已结束", "Ended");
    case "completed":
      return tr("已完成", "Completed");
    case "canceled":
      return tr("已取消", "Canceled");
    case "expired":
      return tr("已过期", "Expired");
    default:
      return status;
  }
}

function appointmentTypeLabel(type: string, tr: TranslateFn) {
  switch (type) {
    case "online_chat":
      return tr("图文问诊", "Online Chat");
    case "video_call":
      return tr("视频问诊", "Video Call");
    case "in_person":
      return tr("线下面诊", "In Person");
    default:
      return type;
  }
}

function formatDateTime(value: Date | string | null, locale: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveEndButtonText(detail: AppointmentDetail, tr: TranslateFn) {
  if (detail.hasSignedMedicalSummary) {
    return tr("查看或更新摘要", "Review Summary");
  }
  if (detail.canCompleteConsultation) {
    return tr("结束问诊并签摘要", "End Visit & Sign Summary");
  }
  return tr("继续完善摘要", "Continue Summary");
}

function renderValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

export function DoctorWorkbenchAppointmentSheet({
  open,
  onOpenChange,
  detail,
  isLoading,
  errorMessage,
  locale,
  tr,
  onStartConsultation,
  onOpenRoom,
  onCompleteAndSummarize,
  isStarting,
  isOpeningRoom,
  isCompleting,
}: Props) {
  const timeDisplay = formatAppointmentTimes(detail?.scheduledAt ?? null, "-", locale);
  const summarySections = detail?.medicalSummary
    ? [
        {
          label: tr("主诉", "Chief Complaint"),
          value: detail.medicalSummary.chiefComplaint,
        },
        {
          label: tr("现病史", "History of Present Illness"),
          value: detail.medicalSummary.historyOfPresentIllness,
        },
        {
          label: tr("既往史", "Past Medical History"),
          value: detail.medicalSummary.pastMedicalHistory,
        },
        {
          label: tr("初步诊断", "Assessment / Diagnosis"),
          value: detail.medicalSummary.assessmentDiagnosis,
        },
        {
          label: tr("处置与建议", "Plan / Recommendations"),
          value: detail.medicalSummary.planRecommendations,
        },
      ]
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-slate-200 bg-[linear-gradient(180deg,#fffdf8_0%,#f8fafc_38%,#ffffff_100%)] p-0 sm:max-w-[760px]"
      >
        <SheetHeader className="border-b border-slate-200/80 bg-white/90 px-6 py-5 backdrop-blur">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-teal-600 text-white">
                {detail ? appointmentTypeLabel(detail.appointmentType, tr) : tr("医生工作台", "Doctor Workbench")}
              </Badge>
              {detail ? (
                <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                  {statusLabel(detail.status, tr)}
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
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
              <CalendarClock className="h-4 w-4 animate-pulse text-teal-600" />
              {tr("正在加载预约详情...", "Loading appointment detail...")}
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : !detail ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
              {tr("请选择一条预约查看详情。", "Select an appointment to review its details.")}
            </div>
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {tr("预约时间", "Visit Time")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{timeDisplay.localTime}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr("医生时间", "Doctor Time")}: {timeDisplay.doctorTime}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {tr("套餐与时长", "Package & Duration")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{renderValue(detail.packageId)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {detail.consultationTotalMinutes} min
                    {detail.consultationExtensionMinutes > 0
                      ? ` (${tr("含延长", "with extension")} +${detail.consultationExtensionMinutes})`
                      : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {tr("患者邮箱", "Patient Email")}
                  </p>
                  <p className="mt-2 break-all text-sm font-medium text-slate-900">{detail.patient.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr("Session", "Session")}: {renderValue(detail.patient.sessionId)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {tr("支付状态", "Payment State")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{detail.paymentStatus}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr("支付时间", "Paid At")}: {formatDateTime(detail.paidAt, locale)}
                  </p>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-rose-500" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tr("诊前资料", "Pre-Visit Intake")}
                      </h3>
                    </div>
                    <div className="mt-4 space-y-4 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {tr("主诉", "Chief Complaint")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.chiefComplaint)}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {tr("病程", "Duration")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.duration)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {tr("年龄段", "Age Group")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.ageGroup)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {tr("既往史", "Medical History")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.medicalHistory)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {tr("当前用药", "Medications")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.medications)}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {tr("过敏史", "Allergies")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.allergies)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {tr("其他症状", "Other Symptoms")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{renderValue(detail.intake?.otherSymptoms)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(160deg,rgba(20,184,166,0.08),rgba(255,255,255,0.95))] p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tr("AI 分诊摘要", "AI Triage Summary")}
                      </h3>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {renderValue(detail.triageSummary)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tr("工作台状态", "Workbench Status")}
                      </h3>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {tr("预约状态", "Appointment Status")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {statusLabel(detail.status, tr)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {tr("接诊方式", "Consultation Type")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {appointmentTypeLabel(detail.appointmentType, tr)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                        #{detail.id}
                      </Badge>
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                        {tr("Triage", "Triage")} #{detail.triageSessionId}
                      </Badge>
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                        {tr("Slot", "Slot")} {detail.slotId ?? "-"}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tr("病历摘要", "Medical Summary")}
                      </h3>
                    </div>
                    {detail.medicalSummary ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-0 bg-emerald-100 text-emerald-700">
                            {detail.hasSignedMedicalSummary
                              ? tr("已签发", "Signed")
                              : tr("草稿", "Draft")}
                          </Badge>
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                            {tr("更新时间", "Updated")}: {formatDateTime(detail.medicalSummary.updatedAt, locale)}
                          </Badge>
                        </div>
                        <div className="space-y-4">
                          {summarySections.map(section => (
                            <div key={section.label}>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                {section.label}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                                {renderValue(section.value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        {tr(
                          "当前还没有已保存的病历摘要。结束问诊后可在这里生成并签发。",
                          "No medical summary has been saved yet. End the consultation to generate and sign one here."
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {detail ? (
          <SheetFooter className="border-t border-slate-200/80 bg-white/95 px-6 py-5 backdrop-blur">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Stethoscope className="h-4 w-4 text-teal-600" />
                {tr(
                  "先查看资料，再开始接诊或进入房间。",
                  "Review context first, then start the consultation or open the room."
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!detail.canStartConsultation || isStarting}
                  onClick={() => onStartConsultation(detail.id)}
                >
                  {isStarting
                    ? tr("接诊中...", "Starting...")
                    : tr("开始接诊", "Start Consultation")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!detail.canOpenRoom || isOpeningRoom}
                  onClick={() => onOpenRoom(detail.id)}
                >
                  {isOpeningRoom ? tr("打开中...", "Opening...") : tr("进入房间", "Open Room")}
                </Button>
                <Button
                  type="button"
                  disabled={isCompleting || !detail.canOpenRoom}
                  onClick={() => onCompleteAndSummarize(detail.id)}
                >
                  {isCompleting
                    ? tr("处理中...", "Processing...")
                    : resolveEndButtonText(detail, tr)}
                </Button>
              </div>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
