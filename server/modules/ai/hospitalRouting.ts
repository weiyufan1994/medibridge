import {
  hospitalReferenceGeneralRankings,
  hospitalReferenceHospitals,
  hospitalReferenceSpecialties,
  hospitalReferenceSpecialtyRankings,
  hospitalReferenceStemRankings,
} from "../../../drizzle/schema";
import * as doctorsRepo from "../doctors/repo";
import { getDb } from "../../db";
import type {
  TriageRouting,
  TriageRoutingHospital,
} from "../../../shared/triageRouting";
import type { TriageCollectedData, TriageDepartmentHint } from "./triageLogic";
import {
  loadHospitalReferenceSeedData,
  normalizeHospitalReferenceText,
} from "./hospitalReferenceData";
import { resolveRecommendedDepartment } from "./triageLogic";
import type { TriageKnowledgeContext, TriageLang } from "./service";

type HospitalReferenceRecord = {
  id: number;
  name: string;
  nameEn: string | null;
  city: string | null;
  cityEn: string | null;
  localHospitalId: number | null;
};

type SpecialtyReferenceRow = {
  specialtyName: string;
  hospitalReferenceId: number;
  specialtyRank: number | null;
  specialtyScore: number | null;
};

type GeneralReferenceRow = {
  hospitalReferenceId: number;
  generalRankOrder: number | null;
  generalGrade: string | null;
};

type StemReferenceRow = {
  hospitalReferenceId: number;
  stemRank: number | null;
};

type HospitalReferenceData = {
  hospitalsById: Map<number, HospitalReferenceRecord>;
  specialtyByName: Map<string, SpecialtyReferenceRow[]>;
  generalByHospitalId: Map<number, GeneralReferenceRow>;
  stemByHospitalId: Map<number, StemReferenceRow>;
};

type LocalHospitalMatch = Awaited<
  ReturnType<typeof doctorsRepo.getAllHospitals>
>[number];

const MAX_HOSPITAL_RESULTS = 5;

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

const GENERAL_GRADE_WEIGHTS: Record<string, number> = {
  "A++++": 5,
  "A+++": 4,
  "A++": 3,
  "A+": 2,
  A: 1,
};

let cachedReferenceData: HospitalReferenceData | null = null;
let cachedReferenceDataSource: "db" | "csv" | null = null;

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

function buildReferenceDataFromSeed(): HospitalReferenceData {
  const { specialtyRows, generalRows, stemRows } = loadHospitalReferenceSeedData();
  const hospitalsById = new Map<number, HospitalReferenceRecord>();
  const hospitalIdByNormalizedName = new Map<string, number>();
  let nextHospitalId = 1;

  const ensureHospitalReference = (hospitalName: string) => {
    const normalizedName = normalizeLookupText(hospitalName);
    const existingId = hospitalIdByNormalizedName.get(normalizedName);
    if (existingId) {
      return existingId;
    }

    const id = nextHospitalId;
    nextHospitalId += 1;
    hospitalIdByNormalizedName.set(normalizedName, id);
    hospitalsById.set(id, {
      id,
      name: hospitalName,
      nameEn: null,
      city: null,
      cityEn: null,
      localHospitalId: null,
    });
    return id;
  };

  const specialtyByName = new Map<string, SpecialtyReferenceRow[]>();
  for (const row of specialtyRows) {
    const hospitalReferenceId = ensureHospitalReference(row.hospitalName);
    const existing = specialtyByName.get(row.specialtyName) ?? [];
    specialtyByName.set(row.specialtyName, [
      ...existing,
      {
        specialtyName: row.specialtyName,
        hospitalReferenceId,
        specialtyRank: row.specialtyRank,
        specialtyScore: row.specialtyScore,
      },
    ]);
  }

  const generalByHospitalId = new Map<number, GeneralReferenceRow>();
  for (const row of generalRows) {
    const hospitalReferenceId = ensureHospitalReference(row.hospitalName);
    generalByHospitalId.set(hospitalReferenceId, {
      hospitalReferenceId,
      generalRankOrder: row.generalRankOrder,
      generalGrade: row.generalGrade,
    });
  }

  const stemByHospitalId = new Map<number, StemReferenceRow>();
  for (const row of stemRows) {
    const hospitalReferenceId = ensureHospitalReference(row.hospitalName);
    stemByHospitalId.set(hospitalReferenceId, {
      hospitalReferenceId,
      stemRank: row.stemRank,
    });
  }

  return {
    hospitalsById,
    specialtyByName,
    generalByHospitalId,
    stemByHospitalId,
  };
}

async function loadReferenceDataFromDatabase(): Promise<HospitalReferenceData | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const [
    hospitalRows,
    specialtyRows,
    specialtyRankingRows,
    generalRankingRows,
    stemRankingRows,
  ] = await Promise.all([
    db.select().from(hospitalReferenceHospitals),
    db.select().from(hospitalReferenceSpecialties),
    db.select().from(hospitalReferenceSpecialtyRankings),
    db.select().from(hospitalReferenceGeneralRankings),
    db.select().from(hospitalReferenceStemRankings),
  ]);

  const hasReferenceData =
    specialtyRankingRows.length > 0 ||
    generalRankingRows.length > 0 ||
    stemRankingRows.length > 0;
  if (hospitalRows.length === 0 || !hasReferenceData) {
    return null;
  }

  const hospitalsById = new Map(
    hospitalRows.map(row => [
      row.id,
      {
        id: row.id,
        name: row.name,
        nameEn: row.nameEn ?? null,
        city: row.city ?? null,
        cityEn: row.cityEn ?? null,
        localHospitalId: row.localHospitalId ?? null,
      } satisfies HospitalReferenceRecord,
    ])
  );
  const specialtyNameById = new Map(
    specialtyRows.map(row => [row.id, row.name] as const)
  );

  const specialtyByName = new Map<string, SpecialtyReferenceRow[]>();
  for (const row of specialtyRankingRows) {
    const specialtyName = specialtyNameById.get(row.specialtyReferenceId);
    if (!specialtyName || !hospitalsById.has(row.hospitalReferenceId)) {
      continue;
    }

    const existing = specialtyByName.get(specialtyName) ?? [];
    specialtyByName.set(specialtyName, [
      ...existing,
      {
        specialtyName,
        hospitalReferenceId: row.hospitalReferenceId,
        specialtyRank: row.specialtyRank,
        specialtyScore: row.specialtyScore,
      },
    ]);
  }

  const generalByHospitalId = new Map(
    generalRankingRows
      .filter(row => hospitalsById.has(row.hospitalReferenceId))
      .map(row => [
        row.hospitalReferenceId,
        {
          hospitalReferenceId: row.hospitalReferenceId,
          generalRankOrder: row.rankOrder,
          generalGrade: row.grade ?? null,
        } satisfies GeneralReferenceRow,
      ])
  );

  const stemByHospitalId = new Map(
    stemRankingRows
      .filter(row => hospitalsById.has(row.hospitalReferenceId))
      .map(row => [
        row.hospitalReferenceId,
        {
          hospitalReferenceId: row.hospitalReferenceId,
          stemRank: row.stemRank,
        } satisfies StemReferenceRow,
      ])
  );

  return {
    hospitalsById,
    specialtyByName,
    generalByHospitalId,
    stemByHospitalId,
  };
}

async function getReferenceData() {
  if (cachedReferenceData && cachedReferenceDataSource === "db") {
    return cachedReferenceData;
  }

  const dbBackedData = await loadReferenceDataFromDatabase();
  if (dbBackedData) {
    cachedReferenceData = dbBackedData;
    cachedReferenceDataSource = "db";
    return dbBackedData;
  }

  if (cachedReferenceData && cachedReferenceDataSource === "csv") {
    return cachedReferenceData;
  }

  const csvFallbackData = buildReferenceDataFromSeed();
  cachedReferenceData = csvFallbackData;
  cachedReferenceDataSource = "csv";
  return csvFallbackData;
}

function buildPossibilitySummary(input: {
  data: TriageCollectedData;
  department: TriageDepartmentHint;
  confidence: TriageRouting["confidence"];
  missingCriticalFields: TriageRouting["missingCriticalFields"];
  lang: TriageLang;
}) {
  const symptom = input.data.mainSymptomAndLocation.trim();
  const duration = input.data.durationAndOnset.trim();
  const missingFieldLabels = input.missingCriticalFields.map(field =>
    input.lang === "zh"
      ? field === "gender"
        ? "性别"
        : "年龄"
      : field === "gender"
        ? "gender"
        : "age"
  );

  if (input.confidence === "reduced" && missingFieldLabels.length > 0) {
    if (input.lang === "zh") {
      return `当前关键信息不足（${missingFieldLabels.join("、")}未提供），以下为更保守的初步分诊建议。目前先按 ${input.department.zh} 方向进一步评估，建议补充相关信息以提高准确性。这是分诊建议，不是明确诊断。`;
    }

    return `Critical information is still missing (${missingFieldLabels.join(", ")} not provided), so the following is a safer preliminary routing suggestion. For now, please start with ${input.department.en} and add those details to improve accuracy. This is routing guidance, not a confirmed diagnosis.`;
  }

  if (input.lang === "zh") {
    const details = [symptom, duration].filter(Boolean).join("，");
    return details
      ? `结合您描述的“${details}”，目前更偏向 ${input.department.zh} 方向，建议先到该专科进一步评估。这是分诊建议，不是明确诊断。`
      : `目前更偏向 ${input.department.zh} 方向，建议先到该专科进一步评估。这是分诊建议，不是明确诊断。`;
  }

  const details = [symptom, duration].filter(Boolean).join(", ");
  return details
    ? `Based on "${details}", this looks more aligned with ${input.department.en}. Please start with that department for in-person evaluation. This is routing guidance, not a confirmed diagnosis.`
    : `This looks more aligned with ${input.department.en}. Please start with that department for in-person evaluation. This is routing guidance, not a confirmed diagnosis.`;
}

function compareHospitals(a: TriageRoutingHospital, b: TriageRoutingHospital) {
  const specialtyRankA = a.specialtyRank ?? Number.POSITIVE_INFINITY;
  const specialtyRankB = b.specialtyRank ?? Number.POSITIVE_INFINITY;
  if (specialtyRankA !== specialtyRankB) {
    return specialtyRankA - specialtyRankB;
  }

  const gradeWeightA = GENERAL_GRADE_WEIGHTS[a.generalGrade ?? ""] ?? 0;
  const gradeWeightB = GENERAL_GRADE_WEIGHTS[b.generalGrade ?? ""] ?? 0;
  if (gradeWeightA !== gradeWeightB) {
    return gradeWeightB - gradeWeightA;
  }

  const stemRankA = a.stemRank ?? Number.POSITIVE_INFINITY;
  const stemRankB = b.stemRank ?? Number.POSITIVE_INFINITY;
  if (stemRankA !== stemRankB) {
    return stemRankA - stemRankB;
  }

  return a.hospitalName.localeCompare(b.hospitalName, "zh-Hans-CN");
}

function buildHospitalReason(input: {
  lang: TriageLang;
  specialtyName: string | null;
  hospital: TriageRoutingHospital;
}) {
  const reasons: string[] = [];

  if (input.lang === "zh") {
    if (input.specialtyName && input.hospital.specialtyRank !== null) {
      reasons.push(
        `2022 复旦 ${input.specialtyName} 声誉榜第 ${input.hospital.specialtyRank} 名`
      );
    }
    if (input.hospital.generalGrade) {
      reasons.push(`全国综合等级 ${input.hospital.generalGrade}`);
    }
    if (input.hospital.stemRank !== null) {
      reasons.push(`医院科技量值第 ${input.hospital.stemRank} 名`);
    }
    return reasons.join("；") || "作为全国参考医院供分诊转诊使用";
  }

  if (input.specialtyName && input.hospital.specialtyRank !== null) {
    reasons.push(
      `Ranked #${input.hospital.specialtyRank} in the 2022 Fudan specialty reputation list`
    );
  }
  if (input.hospital.generalGrade) {
    reasons.push(`General hospital grade ${input.hospital.generalGrade}`);
  }
  if (input.hospital.stemRank !== null) {
    reasons.push(`STEM rank #${input.hospital.stemRank}`);
  }
  return (
    reasons.join("; ") ||
    "Shown as a national reference option for triage routing"
  );
}

async function buildSpecialtyHospitalList(input: {
  specialtyName: string | null;
  lang: TriageLang;
}) {
  const referenceData = await getReferenceData();
  const specialtyRows = input.specialtyName
    ? (referenceData.specialtyByName.get(input.specialtyName) ?? [])
    : [];

  const hospitals: TriageRoutingHospital[] =
    specialtyRows.length > 0
      ? specialtyRows.map(row => {
          const referenceHospital = referenceData.hospitalsById.get(
            row.hospitalReferenceId
          );
          if (!referenceHospital) {
            return null;
          }
          const general = referenceData.generalByHospitalId.get(
            row.hospitalReferenceId
          );
          const stem = referenceData.stemByHospitalId.get(row.hospitalReferenceId);
          const base: TriageRoutingHospital = {
            hospitalName: resolveLocalizedReferenceText({
              lang: input.lang,
              zh: referenceHospital.name,
              en: referenceHospital.nameEn,
            }),
            city: resolveLocalizedReferenceText({
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
        }).filter((hospital): hospital is TriageRoutingHospital => Boolean(hospital))
      : Array.from(referenceData.generalByHospitalId.values()).map(row => {
          const referenceHospital = referenceData.hospitalsById.get(
            row.hospitalReferenceId
          );
          if (!referenceHospital) {
            return null;
          }
          const stem = referenceData.stemByHospitalId.get(row.hospitalReferenceId);
          const base: TriageRoutingHospital = {
            hospitalName: resolveLocalizedReferenceText({
              lang: input.lang,
              zh: referenceHospital.name,
              en: referenceHospital.nameEn,
            }),
            city: resolveLocalizedReferenceText({
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
        }).filter((hospital): hospital is TriageRoutingHospital => Boolean(hospital));

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
    localHospitals = await doctorsRepo.getAllHospitals();
  } catch (error) {
    console.warn(
      "[TriageHospitalRouting] local hospital enhancement skipped:",
      error
    );
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
      hospitalByNormalizedName.get(normalizeLookupText(hospital.hospitalName)) ??
      null;

    if (!matchedHospital) {
      return hospital;
    }

    return {
      ...hospital,
      hospitalName:
        input.lang === "en"
          ? matchedHospital.nameEn ?? hospital.hospitalName
          : matchedHospital.name ?? hospital.hospitalName,
      city:
        input.lang === "en"
          ? matchedHospital.cityEn ?? matchedHospital.city ?? hospital.city
          : matchedHospital.city ?? hospital.city,
      matchedHospitalId: matchedHospital.id,
    };
  });

  if (aliases.length === 0) {
    return enhanced;
  }

  const departmentsByHospitalId = new Map<
    number,
    Awaited<ReturnType<typeof doctorsRepo.getDepartmentsByHospital>>
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
            await doctorsRepo.getDepartmentsByHospital(hospitalId);
          departmentsByHospitalId.set(hospitalId, departments);
        } catch (error) {
          console.warn(
            `[TriageHospitalRouting] local department enhancement skipped for hospital ${hospitalId}:`,
            error
          );
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
