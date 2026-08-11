import { doctorDirectoryApi } from "../doctors/publicApi";
import { createLogger } from "../../_core/logger";
import type {
  TriageRouting,
  TriageRoutingHospital,
} from "../../../shared/triageRouting";
import type { TriageCollectedData } from "./triageLogic";
import { normalizeHospitalReferenceText } from "./hospitalReferenceData";
import { getHospitalReferenceData } from "./hospitalReferenceRepo";
import {
  buildHospitalReason,
  buildPossibilitySummary,
  compareHospitals,
} from "./hospitalRoutingPresentation";
import { resolveRecommendedDepartment } from "./triageLogic";
import type { TriageKnowledgeContext, TriageLang } from "./service";

type LocalHospitalMatch = Awaited<
  ReturnType<typeof doctorDirectoryApi.getAllHospitals>
>[number];

const MAX_HOSPITAL_RESULTS = 5;
const logger = createLogger("triage-hospital-routing");

const FUDAN_SPECIALTY_BY_KEY: Record<string, string> = {
  cardiology: "心血管病",
  respiratory: "呼吸科",
  digestive: "消化科",
  dermatology: "皮肤科",
  neurology: "神经内科",
  orthopedics: "骨科",
  gynecology: "妇产科",
  pediatrics: "小儿内科",
  general_medicine: "全科医学",
  oral: "口腔科",
  rheumatology: "风湿科",
  sports_medicine: "运动医学",
};

const DEPARTMENT_ALIASES_BY_KEY: Record<string, string[]> = {
  cardiology: ["心血管病", "心内科", "心血管内科", "心脏内科"],
  respiratory: ["呼吸科", "呼吸内科", "呼吸与危重症医学科"],
  digestive: ["消化科", "消化内科", "脾胃病科"],
  dermatology: ["皮肤科", "皮肤性病科"],
  neurology: ["神经内科", "神经科"],
  orthopedics: ["骨科", "创伤骨科", "运动医学"],
  gynecology: ["妇产科", "妇科", "产科"],
  pediatrics: ["儿科", "小儿内科", "儿童医学中心"],
  general_medicine: ["全科", "全科医学科", "普通内科", "综合内科"],
  oral: ["口腔科", "口腔颌面外科", "口腔医学中心"],
  rheumatology: ["风湿科", "风湿免疫科"],
  sports_medicine: ["运动医学"],
};

function normalizeLookupText(value: string) {
  return normalizeHospitalReferenceText(value);
}

function resolveLocalizedReferenceText(input: {
  lang: TriageLang;
  zh: string | null | undefined;
  en: string | null | undefined;
}) {
  const zh = input.zh?.trim() ?? "";
  const en = input.en?.trim() ?? "";

  if (input.lang === "en") {
    return en || zh;
  }

  return zh || en;
}

async function buildSpecialtyHospitalList(input: {
  specialtyName: string | null;
  lang: TriageLang;
}) {
  const referenceData = await getHospitalReferenceData();
  const specialtyRows = input.specialtyName
    ? (referenceData.specialtyByName.get(input.specialtyName) ?? [])
    : [];

  const hospitals: TriageRoutingHospital[] =
    specialtyRows.length > 0
      ? specialtyRows
          .map(row => {
            const referenceHospital = referenceData.hospitalsById.get(
              row.hospitalReferenceId
            );
            if (!referenceHospital) {
              return null;
            }
            const general = referenceData.generalByHospitalId.get(
              row.hospitalReferenceId
            );
            const stem = referenceData.stemByHospitalId.get(
              row.hospitalReferenceId
            );
            const base: TriageRoutingHospital = {
              hospitalName: resolveLocalizedReferenceText({
                lang: input.lang,
                zh: referenceHospital.name,
                en: referenceHospital.nameEn,
              }),
              city:
                resolveLocalizedReferenceText({
                  lang: input.lang,
                  zh: referenceHospital.city,
                  en: referenceHospital.cityEn,
                }) || null,
              specialtyRank: row.specialtyRank,
              specialtyScore: row.specialtyScore,
              generalGrade: general?.generalGrade ?? null,
              stemRank: stem?.stemRank ?? null,
              matchedHospitalId: referenceHospital.localHospitalId,
              matchedDepartmentId: null,
              reason: "",
            };

            return {
              ...base,
              reason: buildHospitalReason({
                lang: input.lang,
                specialtyName: input.specialtyName,
                hospital: base,
              }),
            };
          })
          .filter((hospital): hospital is TriageRoutingHospital =>
            Boolean(hospital)
          )
      : Array.from(referenceData.generalByHospitalId.values())
          .map(row => {
            const referenceHospital = referenceData.hospitalsById.get(
              row.hospitalReferenceId
            );
            if (!referenceHospital) {
              return null;
            }
            const stem = referenceData.stemByHospitalId.get(
              row.hospitalReferenceId
            );
            const base: TriageRoutingHospital = {
              hospitalName: resolveLocalizedReferenceText({
                lang: input.lang,
                zh: referenceHospital.name,
                en: referenceHospital.nameEn,
              }),
              city:
                resolveLocalizedReferenceText({
                  lang: input.lang,
                  zh: referenceHospital.city,
                  en: referenceHospital.cityEn,
                }) || null,
              specialtyRank: null,
              specialtyScore: null,
              generalGrade: row.generalGrade,
              stemRank: stem?.stemRank ?? null,
              matchedHospitalId: referenceHospital.localHospitalId,
              matchedDepartmentId: null,
              reason: "",
            };

            return {
              ...base,
              reason: buildHospitalReason({
                lang: input.lang,
                specialtyName: null,
                hospital: base,
              }),
            };
          })
          .filter((hospital): hospital is TriageRoutingHospital =>
            Boolean(hospital)
          );

  return hospitals.sort(compareHospitals).slice(0, MAX_HOSPITAL_RESULTS);
}

async function enhanceWithLocalRecords(input: {
  hospitals: TriageRoutingHospital[];
  departmentKey: string | null;
  lang: TriageLang;
}) {
  if (input.hospitals.length === 0) {
    return [];
  }

  let localHospitals: LocalHospitalMatch[] = [];
  try {
    localHospitals = await doctorDirectoryApi.getAllHospitals();
  } catch (error) {
    logger.warn("hospital_enhancement_skipped", {
      lang: input.lang,
      hospitalCount: input.hospitals.length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return input.hospitals;
  }

  const hospitalByNormalizedName = new Map(
    localHospitals.map(hospital => [
      normalizeLookupText(hospital.name),
      hospital,
    ])
  );
  const hospitalById = new Map(
    localHospitals.map(hospital => [hospital.id, hospital] as const)
  );

  const aliases = input.departmentKey
    ? (DEPARTMENT_ALIASES_BY_KEY[input.departmentKey] ?? [])
    : [];

  const enhanced = input.hospitals.map(hospital => {
    const matchedHospital =
      (hospital.matchedHospitalId
        ? (hospitalById.get(hospital.matchedHospitalId) ?? null)
        : null) ??
      hospitalByNormalizedName.get(
        normalizeLookupText(hospital.hospitalName)
      ) ??
      null;

    if (!matchedHospital) {
      return hospital;
    }

    return {
      ...hospital,
      hospitalName:
        input.lang === "en"
          ? (matchedHospital.nameEn ?? hospital.hospitalName)
          : (matchedHospital.name ?? hospital.hospitalName),
      city:
        input.lang === "en"
          ? (matchedHospital.cityEn ?? matchedHospital.city ?? hospital.city)
          : (matchedHospital.city ?? hospital.city),
      matchedHospitalId: matchedHospital.id,
    };
  });

  if (aliases.length === 0) {
    return enhanced;
  }

  const departmentsByHospitalId = new Map<
    number,
    Awaited<ReturnType<typeof doctorDirectoryApi.getDepartmentsByHospital>>
  >();
  await Promise.all(
    enhanced
      .filter(item => item.matchedHospitalId !== null)
      .map(async item => {
        const hospitalId = item.matchedHospitalId;
        if (!hospitalId || departmentsByHospitalId.has(hospitalId)) {
          return;
        }

        try {
          const departments =
            await doctorDirectoryApi.getDepartmentsByHospital(hospitalId);
          departmentsByHospitalId.set(hospitalId, departments);
        } catch (error) {
          logger.warn("department_enhancement_skipped", {
            hospitalId,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      })
  );

  return enhanced.map(hospital => {
    if (!hospital.matchedHospitalId) {
      return hospital;
    }

    const departments =
      departmentsByHospitalId.get(hospital.matchedHospitalId) ?? [];
    const matchedDepartment =
      departments.find(department => {
        const normalizedDepartmentName = normalizeLookupText(department.name);
        return aliases.some(alias =>
          normalizedDepartmentName.includes(normalizeLookupText(alias))
        );
      }) ?? null;

    return {
      ...hospital,
      matchedDepartmentId: matchedDepartment?.id ?? null,
    };
  });
}

export async function buildHospitalRouting(input: {
  data: TriageCollectedData;
  lang: TriageLang;
  knowledgeContext?: TriageKnowledgeContext;
}): Promise<TriageRouting> {
  const recommendation = resolveRecommendedDepartment({
    data: input.data,
    knowledgeContext: input.knowledgeContext,
  });
  const specialtyName =
    FUDAN_SPECIALTY_BY_KEY[recommendation.department.key] ?? null;
  const hospitals = await enhanceWithLocalRecords({
    hospitals: await buildSpecialtyHospitalList({
      specialtyName,
      lang: input.lang,
    }),
    departmentKey: recommendation.department.key,
    lang: input.lang,
  });

  return {
    possibilitySummary: buildPossibilitySummary({
      data: input.data,
      department: recommendation.department,
      confidence: recommendation.confidence,
      missingCriticalFields: recommendation.missingCriticalFields,
      lang: input.lang,
    }),
    recommendedDepartment: {
      zh: recommendation.department.zh,
      en: recommendation.department.en,
      matchedSpecialtyKey: specialtyName,
    },
    hospitals,
    confidence: recommendation.confidence,
    missingCriticalFields: recommendation.missingCriticalFields,
  };
}
