import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  FileText,
  MapPinned,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildReferralSelectionHref } from "@/features/referrals";
import type { TriageRoutingHospital } from "@shared/triageRouting";

function buildReferralSelectionLink(input: {
  triageSessionId: number;
  hospital: TriageRoutingHospital;
  rankedHospitalIndex: number;
}) {
  if (input.triageSessionId <= 0) {
    return "/triage";
  }

  return buildReferralSelectionHref({
    triageSessionId: input.triageSessionId,
    rankedHospitalIndex: input.rankedHospitalIndex,
    hospitalId: input.hospital.matchedHospitalId ?? undefined,
  });
}

export function buildPrimaryReferralEntryHref(input: {
  triageSessionId: number;
  hospitals: TriageRoutingHospital[];
}) {
  for (
    let rankedHospitalIndex = 0;
    rankedHospitalIndex < input.hospitals.length;
    rankedHospitalIndex += 1
  ) {
    const hospital = input.hospitals[rankedHospitalIndex];
    const href = buildReferralSelectionLink({
      triageSessionId: input.triageSessionId,
      hospital,
      rankedHospitalIndex,
    });
    if (href) {
      return href;
    }
  }

  return "/triage";
}

export function TriageHospitalRoutingCard(props: {
  triageSessionId: number;
  summary: string;
  possibilitySummary: string;
  recommendedDepartment: string;
  hospitals: TriageRoutingHospital[];
  safetyNotice?: {
    title: string;
    description: string;
  } | null;
  labels: {
    summary: string;
    possibility: string;
    department: string;
    recommendedHospitals: string;
    notDiagnosis: string;
    browseHospital: string;
    nextStepTitle: string;
    nextStepDescription: string;
    platformMatch: string;
    manualCoordination: string;
    noHospitals: string;
  };
}) {
  return (
    <div className="w-full rounded-2xl border border-teal-200 bg-white p-5 shadow-md">
      <div className="space-y-5">
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileText className="h-4 w-4" />
            {props.labels.summary}
          </h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {props.summary}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Stethoscope className="h-4 w-4 text-teal-600" />
              {props.labels.possibility}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {props.possibilitySummary}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {props.labels.notDiagnosis}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-teal-50/70 p-4">
            <p className="text-sm font-medium text-slate-900">
              {props.labels.department}
            </p>
            <Badge className="mt-3 rounded-full border-0 bg-teal-600 px-3 py-1 text-white">
              {props.recommendedDepartment}
            </Badge>
          </div>
        </div>

        {props.safetyNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {props.safetyNotice.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              {props.safetyNotice.description}
            </p>
          </div>
        ) : null}

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Building2 className="h-4 w-4" />
            {props.labels.recommendedHospitals}
          </h4>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/90 p-2 text-teal-600 shadow-sm">
                <MapPinned className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-900">
                  {props.labels.nextStepTitle}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-teal-800">
                  {props.labels.nextStepDescription}
                </p>
              </div>
            </div>
          </div>

          {props.hospitals.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {props.labels.noHospitals}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {props.hospitals.map((hospital, index) => {
                const referralHref = buildReferralSelectionLink({
                  triageSessionId: props.triageSessionId,
                  hospital,
                  rankedHospitalIndex: index,
                });
                return (
                  <Link
                    key={`${hospital.hospitalName}-${index}`}
                    href={referralHref}
                    className="group block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {hospital.hospitalName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {hospital.specialtyRank !== null ? (
                            <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">
                              #{hospital.specialtyRank}
                            </Badge>
                          ) : null}
                          {hospital.generalGrade ? (
                            <Badge className="rounded-full border-0 bg-sky-50 text-sky-700">
                              {hospital.generalGrade}
                            </Badge>
                          ) : null}
                          {hospital.stemRank !== null ? (
                            <Badge className="rounded-full border-0 bg-amber-50 text-amber-700">
                              STEM #{hospital.stemRank}
                            </Badge>
                          ) : null}
                          {hospital.matchedHospitalId ? (
                            <Badge className="rounded-full border-0 bg-violet-50 text-violet-700">
                              {props.labels.platformMatch}
                            </Badge>
                          ) : (
                            <Badge className="rounded-full border-0 bg-teal-50 text-teal-700">
                              {props.labels.manualCoordination}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {hospital.reason}
                    </p>
                    {hospital.city ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {hospital.city}
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">
                      <span>{props.labels.browseHospital}</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
