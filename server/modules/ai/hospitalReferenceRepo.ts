import {
  hospitalReferenceGeneralRankings,
  hospitalReferenceHospitals,
  hospitalReferenceSpecialties,
  hospitalReferenceSpecialtyRankings,
  hospitalReferenceStemRankings,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import {
  loadHospitalReferenceSeedData,
  normalizeHospitalReferenceText,
} from "./hospitalReferenceData";

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

let cachedReferenceData: HospitalReferenceData | null = null;
let cachedReferenceDataSource: "db" | "csv" | null = null;

function normalizeLookupText(value: string) {
  return normalizeHospitalReferenceText(value);
}

function buildReferenceDataFromSeed(): HospitalReferenceData {
  const { specialtyRows, generalRows, stemRows } =
    loadHospitalReferenceSeedData();
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

export async function getHospitalReferenceData() {
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
