import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import { aiHistoricalTriageApi } from "../ai/publicApi";
import { requireUser } from "./accessControl";
import * as referralRepo from "./repo";
import {
  toPublicReferralContact,
  toReferralDisplayDepartment,
  toReferralDisplayHospital,
} from "./presentation";
import type {
  getSelectionContextInputSchema,
  getTriageRecommendationsInputSchema,
} from "./schemas";

type TriageRecommendationsInput = z.infer<
  typeof getTriageRecommendationsInputSchema
>;
type SelectionContextInput = z.infer<typeof getSelectionContextInputSchema>;
type OwnedTriageRecommendation = Awaited<
  ReturnType<typeof getOwnedTriageRecommendation>
>;
type RankedHospitalRecommendation = NonNullable<
  NonNullable<OwnedTriageRecommendation["triageResult"]>["routing"]
>["hospitals"][number];

async function getOwnedTriageRecommendation(input: {
  triageSessionId: number;
  userId: number;
}) {
  const owned = await aiHistoricalTriageApi.getForUser({
    sessionId: input.triageSessionId,
    userId: input.userId,
  });
  if (!owned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Triage session not found",
    });
  }

  return owned;
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）[\]【】{}<>《》.,，。:：;；'"`‘’“”·•\-_/\\|]/g, "");
}

export function isPositiveInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function matchesDepartmentLabel(input: {
  departmentName: string;
  candidates: Array<string | null | undefined>;
}) {
  const normalizedDepartmentName = normalizeLookupText(input.departmentName);
  if (!normalizedDepartmentName) {
    return false;
  }

  return input.candidates.some(candidate => {
    const normalizedCandidate = normalizeLookupText(candidate);
    return (
      normalizedCandidate.length > 0 &&
      (normalizedDepartmentName.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedDepartmentName))
    );
  });
}

export async function resolveRankedHospitalSelection(input: {
  triageSessionId: number;
  userId: number;
  rankedHospitalIndex?: number;
  hospitalId?: number;
}) {
  const owned = await getOwnedTriageRecommendation({
    triageSessionId: input.triageSessionId,
    userId: input.userId,
  });
  const rankedHospitals = owned.triageResult?.routing?.hospitals ?? [];

  const selectedByIndex =
    typeof input.rankedHospitalIndex === "number"
      ? (rankedHospitals[input.rankedHospitalIndex] ?? null)
      : null;
  const selectedHospital =
    selectedByIndex ??
    (isPositiveInteger(input.hospitalId)
      ? (rankedHospitals.find(
          hospital => hospital.matchedHospitalId === input.hospitalId
        ) ?? null)
      : null);

  if (!selectedHospital) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ranked hospital not found",
    });
  }

  return {
    ...owned,
    selectedHospital,
  };
}

export async function resolveLocalHospitalForRankedHospital(
  rankedHospital: RankedHospitalRecommendation
) {
  const matchedHospitalId = rankedHospital.matchedHospitalId;
  if (isPositiveInteger(matchedHospitalId)) {
    const hospitalId = matchedHospitalId as number;
    const matchedHospital = await referralRepo.getHospitalById(hospitalId);
    if (matchedHospital && matchedHospital.isActive === 1) {
      return matchedHospital;
    }
  }

  const normalizedTargetName = normalizeLookupText(rankedHospital.hospitalName);
  if (!normalizedTargetName) {
    return null;
  }

  const hospitals = await referralRepo.listHospitalsForReferralCatalog();
  return (
    hospitals.find(
      hospital =>
        hospital.isActive === 1 &&
        [
          normalizeLookupText(hospital.name),
          normalizeLookupText(hospital.nameEn),
        ].includes(normalizedTargetName)
    ) ?? null
  );
}

export async function resolveLocalDepartmentForRankedHospital(input: {
  localHospitalId: number | null;
  rankedHospital: RankedHospitalRecommendation;
  triageResult: OwnedTriageRecommendation["triageResult"];
}) {
  const localHospitalId = input.localHospitalId;
  if (!isPositiveInteger(localHospitalId)) {
    return null;
  }

  const matchedDepartmentId = input.rankedHospital.matchedDepartmentId;
  if (isPositiveInteger(matchedDepartmentId)) {
    const departmentId = matchedDepartmentId as number;
    const matchedDepartment =
      await referralRepo.getDepartmentById(departmentId);
    if (
      matchedDepartment &&
      matchedDepartment.isActive === 1 &&
      matchedDepartment.hospitalId === localHospitalId
    ) {
      return matchedDepartment;
    }
  }

  const hospitalId = localHospitalId as number;
  const departments =
    await referralRepo.listDepartmentsByHospitalId(hospitalId);
  const activeDepartments = departments.filter(
    department => department.isActive === 1
  );
  const recommendedDepartment =
    input.triageResult?.routing?.recommendedDepartment;

  return (
    activeDepartments.find(department =>
      matchesDepartmentLabel({
        departmentName: department.name,
        candidates: [recommendedDepartment?.zh, recommendedDepartment?.en],
      })
    ) ?? null
  );
}

export async function getTriageRecommendationsAction(
  user: User | null,
  input: TriageRecommendationsInput
) {
  const currentUser = requireUser(user);
  const { session, triageResult } = await getOwnedTriageRecommendation({
    triageSessionId: input.triageSessionId,
    userId: currentUser.id,
  });

  return {
    triageSessionId: session.id,
    summary: session.summary ?? null,
    recommendedDepartment: triageResult?.routing
      ? triageResult.routing.recommendedDepartment
      : null,
    hospitals: triageResult?.routing?.hospitals ?? [],
  };
}

export async function getSelectionContextAction(
  user: User | null,
  input: SelectionContextInput
) {
  const currentUser = requireUser(user);
  const { session, triageResult, selectedHospital } =
    await resolveRankedHospitalSelection({
      triageSessionId: input.triageSessionId,
      userId: currentUser.id,
      rankedHospitalIndex: input.rankedHospitalIndex,
      hospitalId: input.hospitalId,
    });
  const localHospital =
    await resolveLocalHospitalForRankedHospital(selectedHospital);
  const localDepartment = await resolveLocalDepartmentForRankedHospital({
    localHospitalId: localHospital?.id ?? null,
    rankedHospital: selectedHospital,
    triageResult,
  });
  const contacts =
    localHospital && localDepartment
      ? await referralRepo.listActiveContactsByHospital({
          hospitalId: localHospital.id,
          departmentId: localDepartment.id,
        })
      : [];
  const recommendedDepartment =
    triageResult?.routing?.recommendedDepartment ?? null;
  const manualFulfillmentRequired =
    !localHospital || !localDepartment || contacts.length === 0;

  return {
    triageSessionId: session.id,
    triageSummary: session.summary ?? null,
    recommendationReason: selectedHospital.reason,
    manualFulfillmentRequired,
    manualFallbackAvailable: contacts.length === 0,
    hospital: toReferralDisplayHospital({
      hospital: localHospital,
      snapshotHospitalName: selectedHospital.hospitalName,
      snapshotCity: selectedHospital.city,
    }),
    department: toReferralDisplayDepartment({
      department: localDepartment,
      snapshotDepartmentName: recommendedDepartment?.zh ?? null,
      snapshotDepartmentNameEn: recommendedDepartment?.en ?? null,
    }),
    contacts: contacts.map(toPublicReferralContact),
  };
}
