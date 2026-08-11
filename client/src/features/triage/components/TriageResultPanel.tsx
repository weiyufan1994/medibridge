import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocalizedTriageText, getTriageCopy } from "../copy";
import type { TriageResult } from "../hooks/triageChatTypes";
import { getTriageResultContainerClass } from "./aiTriageMessagePresentation";
import { LightTriageSummaryFormCard } from "./LightTriageSummaryFormCard";
import { TriageHospitalRoutingCard } from "./TriageHospitalRoutingCard";
import type { LightTriageResultForm } from "@shared/triageRouting";

export function TriageResultPanel(props: {
  result: TriageResult | null;
  resolved: "zh" | "en";
  triageSessionId: number;
  effectiveSummary: string;
  localizedInterruptionDetail: string | null;
  routingSafetyNotice: { title: string; description: string } | null;
  resultFormDraft: LightTriageResultForm;
  readOnly: boolean;
  onResultFormChange: <K extends keyof LightTriageResultForm>(
    key: K,
    value: LightTriageResultForm[K]
  ) => void;
  onNavigate: (href: string) => void;
  copy: ReturnType<typeof getTriageCopy>;
}) {
  if (!props.result?.isComplete) {
    return null;
  }

  const t = props.copy;
  return (
    <div className={getTriageResultContainerClass()}>
      <div className="w-full max-w-[85%]">
        {props.result.interrupted ? (
          <div className="overflow-hidden rounded-[28px] border border-rose-200/80 bg-[linear-gradient(145deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))] shadow-[0_18px_40px_-24px_rgba(225,29,72,0.55)]">
            <div className="border-b border-rose-200/70 bg-white/55 px-5 py-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-rose-600 p-2 text-white shadow-sm">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">
                    {t.interruption.eyebrow}
                  </p>
                  <h4 className="text-lg font-semibold text-rose-900">
                    {t.interruption.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-rose-700">
                    {t.interruption.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-2xl border border-rose-100 bg-white/80 p-4">
                <p className="mb-2 text-sm font-medium text-rose-900">
                  {t.interruption.next_steps_title}
                </p>
                <ul className="space-y-2 text-sm leading-relaxed text-rose-800">
                  {t.interruption.next_steps.map(step => (
                    <li key={step} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-100/70 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-700">
                  {props.localizedInterruptionDetail}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                  onClick={() => props.onNavigate("/hospitals")}
                >
                  {t.interruption.primary_cta}
                </Button>
                <Button
                  variant="outline"
                  className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  onClick={() => props.onNavigate("/")}
                >
                  {t.interruption.secondary_cta}
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-rose-500">
                {t.interruption.footer}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <TriageHospitalRoutingCard
              triageSessionId={props.triageSessionId}
              summary={props.effectiveSummary}
              possibilitySummary={
                props.result.routing?.possibilitySummary ??
                t.triage_card.possibility_fallback
              }
              recommendedDepartment={getLocalizedTriageText({
                lang: props.resolved,
                text: props.result.routing?.recommendedDepartment,
                fallback: t.triage_card.department_fallback,
              })}
              hospitals={props.result.routing?.hospitals ?? []}
              safetyNotice={props.routingSafetyNotice}
              labels={{
                summary: t.triage_card.summary,
                possibility: t.triage_card.possibility,
                department: t.triage_card.recommended_department,
                recommendedHospitals: t.triage_card.recommended_hospitals,
                notDiagnosis: t.triage_card.not_diagnosis,
                browseHospital: t.triage_card.browse_hospital,
                nextStepTitle: t.triage_card.next_step_title,
                nextStepDescription: t.triage_card.next_step_description,
                platformMatch: t.triage_card.platform_match,
                manualCoordination: t.triage_card.manual_coordination,
                noHospitals: t.triage_card.no_hospitals,
              }}
            />
            <LightTriageSummaryFormCard
              draft={props.resultFormDraft}
              onChange={props.onResultFormChange}
              readOnly={props.readOnly}
              labels={{
                title: t.summary_form.title,
                description: t.summary_form.description,
                ageGender: t.summary_form.age_gender,
                mainSymptomAndLocation:
                  t.summary_form.main_symptom_and_location,
                durationAndOnset: t.summary_form.duration_and_onset,
                traumaOrSurgery: t.summary_form.trauma_or_surgery,
                medicalHistory: t.summary_form.medical_history,
                otherSymptoms: t.summary_form.other_symptoms,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
