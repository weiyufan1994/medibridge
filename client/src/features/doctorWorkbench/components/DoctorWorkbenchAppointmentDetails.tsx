import { ClipboardList, FileText, HeartPulse, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAppointmentTimes } from "@/lib/appointmentTime";
import {
  formatDoctorWorkbenchDateTime,
  getDoctorWorkbenchAppointmentTypeLabel,
  getDoctorWorkbenchStatusLabel,
  renderDoctorWorkbenchDetailValue,
} from "../presentation";
import type {
  DoctorWorkbenchAppointmentDetail,
  DoctorWorkbenchLanguage,
  DoctorWorkbenchTranslate,
} from "../types";

export function DoctorWorkbenchAppointmentDetails(props: {
  detail: DoctorWorkbenchAppointmentDetail;
  locale: string;
  lang: DoctorWorkbenchLanguage;
  tr: DoctorWorkbenchTranslate;
}) {
  const { detail, locale, lang, tr } = props;
  const timeDisplay = formatAppointmentTimes(detail.scheduledAt, "-", locale);
  const summarySections = detail.medicalSummary
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
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tr("预约时间", "Visit Time")}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {timeDisplay.localTime}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr("医生时间", "Doctor Time")}: {timeDisplay.doctorTime}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tr("套餐与时长", "Package & Duration")}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {renderDoctorWorkbenchDetailValue(detail.packageId)}
          </p>
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
          <p className="mt-2 break-all text-sm font-medium text-slate-900">
            {detail.patient.email}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr("Session", "Session")}:{" "}
            {renderDoctorWorkbenchDetailValue(detail.patient.sessionId)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tr("支付状态", "Payment State")}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {detail.paymentStatus}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr("支付时间", "Paid At")}:{" "}
            {formatDoctorWorkbenchDateTime(detail.paidAt, locale)}
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
                <p className="mt-1 whitespace-pre-wrap">
                  {renderDoctorWorkbenchDetailValue(
                    detail.intake?.chiefComplaint
                  )}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {tr("病程", "Duration")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {renderDoctorWorkbenchDetailValue(detail.intake?.duration)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {tr("年龄段", "Age Group")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {renderDoctorWorkbenchDetailValue(detail.intake?.ageGroup)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {tr("既往史", "Medical History")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {renderDoctorWorkbenchDetailValue(
                    detail.intake?.medicalHistory
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {tr("当前用药", "Medications")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {renderDoctorWorkbenchDetailValue(detail.intake?.medications)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {tr("过敏史", "Allergies")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {renderDoctorWorkbenchDetailValue(detail.intake?.allergies)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {tr("其他症状", "Other Symptoms")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {renderDoctorWorkbenchDetailValue(
                      detail.intake?.otherSymptoms
                    )}
                  </p>
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
              {renderDoctorWorkbenchDetailValue(detail.triageSummary)}
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
                  {getDoctorWorkbenchStatusLabel(detail.status, lang)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {tr("接诊方式", "Consultation Type")}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {getDoctorWorkbenchAppointmentTypeLabel(
                    detail.appointmentType,
                    lang
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-slate-300 bg-white text-slate-700"
              >
                #{detail.id}
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-300 bg-white text-slate-700"
              >
                {tr("Triage", "Triage")} #{detail.triageSessionId}
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-300 bg-white text-slate-700"
              >
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
                  <Badge
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-700"
                  >
                    {tr("更新时间", "Updated")}:{" "}
                    {formatDoctorWorkbenchDateTime(
                      detail.medicalSummary.updatedAt,
                      locale
                    )}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {summarySections.map(section => (
                    <div key={section.label}>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {section.label}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {renderDoctorWorkbenchDetailValue(section.value)}
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
  );
}
