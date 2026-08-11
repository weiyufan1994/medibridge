import { buildReferralSelectionHref } from "@/features/referrals";
import type { TriageRoutingHospital } from "@shared/triageRouting";

export function buildReferralSelectionLink(input: {
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
