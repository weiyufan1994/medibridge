import { and, desc, eq, inArray, like, notLike, or } from "drizzle-orm";
import {
  departments,
  doctorEmbeddings,
  doctorSpecialtyTags,
  doctors,
  hospitals,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

type SearchLanguage = "en" | "zh";

export type DoctorSearchResult = {
  doctor: typeof doctors.$inferSelect;
  hospital: typeof hospitals.$inferSelect;
  department: typeof departments.$inferSelect;
};

type SearchDoctorsOptions = {
  lang?: SearchLanguage;
  fallbackKeywords?: string[];
  candidateDoctorIds?: number[];
};

const normalizeCandidateDoctorIds = (candidateDoctorIds?: number[]) =>
  Array.from(
    new Set(
      (candidateDoctorIds ?? []).filter(
        id => Number.isInteger(id) && id > 0
      )
    )
  );

const buildSearchConditions = (keywords: string[], fields: Array<any>) => {
  const cleaned = keywords.map(keyword => keyword.trim()).filter(Boolean);
  return cleaned.flatMap(keyword => fields.map(field => like(field, `%${keyword}%`)));
};

export async function searchDoctors(
  keywords: string[],
  limit: number = 20,
  options: SearchDoctorsOptions = {}
): Promise<DoctorSearchResult[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const lang = options.lang ?? "zh";
  const primaryFields =
    lang === "en"
      ? [
          doctors.nameEn,
          doctors.titleEn,
          doctors.specialtyEn,
          doctors.expertiseEn,
          departments.nameEn,
          hospitals.nameEn,
        ]
      : [
          doctors.name,
          doctors.title,
          doctors.specialty,
          doctors.expertise,
          departments.name,
          hospitals.name,
        ];

  const primaryConditions = buildSearchConditions(keywords, primaryFields);
  if (primaryConditions.length === 0) {
    return [];
  }

  const candidateDoctorIds = normalizeCandidateDoctorIds(
    options.candidateDoctorIds
  );
  if (options.candidateDoctorIds && candidateDoctorIds.length === 0) {
    return [];
  }

  const primaryPredicate =
    candidateDoctorIds.length > 0
      ? and(or(...primaryConditions), inArray(doctors.id, candidateDoctorIds))
      : or(...primaryConditions);

  const primaryResults = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .where(primaryPredicate)
    .orderBy(desc(doctors.recommendationScore))
    .limit(limit);

  if (lang !== "en" || !options.fallbackKeywords || options.fallbackKeywords.length === 0) {
    return primaryResults;
  }

  const fallbackFields = [
    doctors.name,
    doctors.title,
    doctors.specialty,
    doctors.expertise,
    departments.name,
    hospitals.name,
  ];
  const fallbackConditions = buildSearchConditions(options.fallbackKeywords, fallbackFields);
  if (fallbackConditions.length === 0) {
    return primaryResults;
  }

  const fallbackPredicate =
    candidateDoctorIds.length > 0
      ? and(or(...fallbackConditions), inArray(doctors.id, candidateDoctorIds))
      : or(...fallbackConditions);

  const fallbackResults = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .where(fallbackPredicate)
    .orderBy(desc(doctors.recommendationScore))
    .limit(limit);

  const merged = new Map<number, (typeof primaryResults)[number]>();
  for (const result of primaryResults) {
    merged.set(result.doctor.id, result);
  }
  for (const result of fallbackResults) {
    if (!merged.has(result.doctor.id)) {
      merged.set(result.doctor.id, result);
    }
  }

  return Array.from(merged.values()).slice(0, limit);
}

const parseEmbedding = (value: unknown): number[] | null => {
  if (!value) return null;

  if (Array.isArray(value)) {
    const vector = value.map(Number).filter(Number.isFinite);
    return vector.length > 0 ? vector : null;
  }

  if (typeof value === "string") {
    try {
      return parseEmbedding(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return null;
};

const cosineSimilarity = (left: number[], right: number[]) => {
  const dimensions = Math.min(left.length, right.length);
  if (dimensions === 0) return 0;

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < dimensions; index++) {
    const leftValue = left[index];
    const rightValue = right[index];
    dotProduct += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export async function searchDoctorsByEmbedding(
  queryEmbedding: number[],
  limit: number = 20,
  options: { candidateDoctorIds?: number[] } = {}
): Promise<DoctorSearchResult[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const candidateDoctorIds = normalizeCandidateDoctorIds(
    options.candidateDoctorIds
  );
  if (options.candidateDoctorIds && candidateDoctorIds.length === 0) {
    return [];
  }

  const rowsQuery = db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
      embedding: doctorEmbeddings.embedding,
    })
    .from(doctorEmbeddings)
    .innerJoin(doctors, eq(doctorEmbeddings.doctorId, doctors.id))
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id));

  const rows =
    candidateDoctorIds.length > 0
      ? await rowsQuery.where(inArray(doctors.id, candidateDoctorIds))
      : await rowsQuery;

  const ranked = rows
    .map(row => {
      const vector = parseEmbedding(row.embedding);
      if (!vector) return null;
      const similarity = cosineSimilarity(queryEmbedding, vector);
      return {
        doctor: row.doctor,
        hospital: row.hospital,
        department: row.department,
        similarity,
      };
    })
    .filter((item): item is DoctorSearchResult & { similarity: number } => {
      return item !== null && Number.isFinite(item.similarity) && item.similarity > 0;
    })
    .sort((left, right) => {
      if (right.similarity !== left.similarity) {
        return right.similarity - left.similarity;
      }
      return (
        (right.doctor.recommendationScore ?? 0) -
        (left.doctor.recommendationScore ?? 0)
      );
    })
    .slice(0, limit)
    .map(({ doctor, hospital, department }) => ({ doctor, hospital, department }));

  return ranked;
}

export async function listDoctorSpecialtyTagsByDoctorIds(doctorIds: number[]) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const normalizedIds = Array.from(
    new Set(doctorIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (normalizedIds.length === 0) {
    return new Map<number, string[]>();
  }

  const rows = await db
    .select({
      doctorId: doctorSpecialtyTags.doctorId,
      tag: doctorSpecialtyTags.tag,
    })
    .from(doctorSpecialtyTags)
    .where(or(...normalizedIds.map(id => eq(doctorSpecialtyTags.doctorId, id))));

  const tagMap = new Map<number, string[]>();
  for (const row of rows) {
    const existing = tagMap.get(row.doctorId) ?? [];
    existing.push(row.tag);
    tagMap.set(row.doctorId, existing);
  }

  return tagMap;
}

export async function listRecommendationCandidates() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .orderBy(desc(doctors.recommendationScore));
}

export async function getDoctorById(doctorId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const results = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .where(eq(doctors.id, doctorId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

export async function getAllHospitals() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.select().from(hospitals).orderBy(hospitals.name);
}

export async function getHospitalById(hospitalId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function setHospitalImageUrl(
  hospitalId: number,
  imageUrl: string | null
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(hospitals)
    .set({ imageUrl })
    .where(eq(hospitals.id, hospitalId));
}

export async function getDepartmentsByHospital(hospitalId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .select()
    .from(departments)
    .where(
      and(
        eq(departments.hospitalId, hospitalId),
        notLike(departments.name, "%医生信息%")
      )
    )
    .orderBy(departments.name);
}

export async function getDoctorsByDepartment(
  departmentId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const results = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .where(eq(doctors.departmentId, departmentId))
    .orderBy(desc(doctors.recommendationScore))
    .limit(limit);

  return results;
}
