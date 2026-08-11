import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LightTriageResultForm } from "@shared/triageRouting";

export function LightTriageSummaryFormCard(props: {
  draft: LightTriageResultForm;
  onChange: <K extends keyof LightTriageResultForm>(
    key: K,
    value: LightTriageResultForm[K]
  ) => void;
  readOnly?: boolean;
  labels: {
    title: string;
    description: string;
    ageGender: string;
    mainSymptomAndLocation: string;
    durationAndOnset: string;
    traumaOrSurgery: string;
    medicalHistory: string;
    otherSymptoms: string;
  };
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-slate-900">
          {props.labels.title}
        </h4>
        <p className="mt-1 text-sm text-slate-500">
          {props.labels.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="triage-summary-age-gender">
            {props.labels.ageGender}
          </Label>
          <Input
            id="triage-summary-age-gender"
            value={props.draft.ageGender}
            onChange={event => props.onChange("ageGender", event.target.value)}
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-duration">
            {props.labels.durationAndOnset}
          </Label>
          <Input
            id="triage-summary-duration"
            value={props.draft.durationAndOnset}
            onChange={event =>
              props.onChange("durationAndOnset", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="triage-summary-symptom">
            {props.labels.mainSymptomAndLocation}
          </Label>
          <Textarea
            id="triage-summary-symptom"
            value={props.draft.mainSymptomAndLocation}
            onChange={event =>
              props.onChange("mainSymptomAndLocation", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2 min-h-[88px]"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-trauma">
            {props.labels.traumaOrSurgery}
          </Label>
          <Input
            id="triage-summary-trauma"
            value={props.draft.traumaOrSurgery}
            onChange={event =>
              props.onChange("traumaOrSurgery", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="triage-summary-history">
            {props.labels.medicalHistory}
          </Label>
          <Input
            id="triage-summary-history"
            value={props.draft.medicalHistory}
            onChange={event =>
              props.onChange("medicalHistory", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="triage-summary-other">
            {props.labels.otherSymptoms}
          </Label>
          <Textarea
            id="triage-summary-other"
            value={props.draft.otherSymptoms}
            onChange={event =>
              props.onChange("otherSymptoms", event.target.value)
            }
            disabled={props.readOnly}
            className="mt-2 min-h-[88px]"
          />
        </div>
      </div>
    </div>
  );
}
