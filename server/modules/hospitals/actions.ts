import type { LocalizedText } from "@shared/types";
import { and, asc, eq, notLike, sql } from "drizzle-orm";
import { departments, hospitals } from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { GetHospitalDepartmentsInput, GetHospitalsInput } from "./schemas";

type HospitalRow = typeof hospitals.$inferSelect;
type DepartmentRow = typeof departments.$inferSelect;

type PublicLocalizedHospital = Omit<
  HospitalRow,
  | "name"
  | "nameEn"
  | "city"
  | "cityEn"
  | "level"
  | "levelEn"
  | "address"
  | "addressEn"
> & {
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  address: LocalizedText;
};

type PublicLocalizedDepartment = Omit<DepartmentRow, "name" | "nameEn"> & {
  name: LocalizedText;
};

function toLocalizedText(
  zh: string | null | undefined,
  en: string | null | undefined
): LocalizedText {
  return {
    zh: zh ?? "",
    en: en ?? "",
  };
}

function toPublicLocalizedHospital(
  hospital: HospitalRow
): PublicLocalizedHospital {
  const {
    name,
    nameEn,
    city,
    cityEn,
    level,
    levelEn,
    address,
    addressEn,
    ...rest
  } = hospital;

  return {
    ...rest,
    name: toLocalizedText(name, nameEn),
    city: toLocalizedText(city, cityEn),
    level: toLocalizedText(level, levelEn),
    address: toLocalizedText(address, addressEn),
  };
}

function toPublicLocalizedDepartment(
  department: DepartmentRow
): PublicLocalizedDepartment {
  const { name, nameEn, ...rest } = department;

  return {
    ...rest,
    name: toLocalizedText(name, nameEn),
  };
}

export async function getAllHospitals(input: GetHospitalsInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(hospitals)
    .orderBy(
      asc(
        input.lang === "en"
          ? sql`coalesce(${hospitals.nameEn}, ${hospitals.name})`
          : sql`coalesce(${hospitals.name}, ${hospitals.nameEn})`
      ),
      asc(hospitals.id)
    );
  return rows.map(toPublicLocalizedHospital);
}

export async function getDepartmentsByHospital(
  input: GetHospitalDepartmentsInput
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(departments)
    .where(
      and(
        eq(departments.hospitalId, input.hospitalId),
        notLike(departments.name, "%医生信息%")
      )
    )
    .orderBy(
      asc(
        input.lang === "en"
          ? sql`coalesce(${departments.nameEn}, ${departments.name})`
          : sql`coalesce(${departments.name}, ${departments.nameEn})`
      ),
      asc(departments.id)
    );

  return rows.map(toPublicLocalizedDepartment);
}
