import { and, asc, desc, eq, notLike, sql } from "drizzle-orm";
import { departments, doctors, hospitals } from "../../../drizzle/schema";
import { DEFAULT_HOSPITAL_BROWSE_LANG } from "../../../shared/hospitalBrowse";
import { getDb } from "../../db";

type SearchLanguage = "en" | "zh";

export async function getDoctorById(
  doctorId: number,
  _lang: SearchLanguage = DEFAULT_HOSPITAL_BROWSE_LANG
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
  limit: number = 50,
  lang: SearchLanguage = "zh"
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
    .orderBy(
      desc(doctors.recommendationScore),
      asc(
        lang === "en"
          ? sql`coalesce(${doctors.nameEn}, ${doctors.name})`
          : sql`coalesce(${doctors.name}, ${doctors.nameEn})`
      ),
      asc(doctors.id)
    )
    .limit(limit);

  return results;
}
