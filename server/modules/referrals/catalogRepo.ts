import { and, asc, desc, eq } from "drizzle-orm";
import {
  departments,
  hospitals,
  referralContacts,
  type InsertReferralContact,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

type UpsertReferralContactValues = InsertReferralContact & { id?: number };

async function resolveDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function getHospitalById(hospitalId: number) {
  const db = await resolveDb();
  const rows = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getDepartmentById(departmentId: number) {
  const db = await resolveDb();
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getContactById(contactId: number) {
  const db = await resolveDb();
  const rows = await db
    .select()
    .from(referralContacts)
    .where(eq(referralContacts.id, contactId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listActiveContactsByHospital(input: {
  hospitalId: number;
  departmentId?: number | null;
}) {
  const db = await resolveDb();
  const filters = [
    eq(referralContacts.hospitalId, input.hospitalId),
    eq(referralContacts.isActive, 1),
  ];

  if (typeof input.departmentId === "number" && input.departmentId > 0) {
    filters.push(eq(referralContacts.departmentId, input.departmentId));
  }

  return db
    .select()
    .from(referralContacts)
    .where(and(...filters))
    .orderBy(
      asc(referralContacts.avgResponseTimeMinutes),
      desc(referralContacts.successRate),
      asc(referralContacts.id)
    );
}

export async function listHospitalsForReferralCatalog() {
  const db = await resolveDb();
  return db
    .select()
    .from(hospitals)
    .orderBy(asc(hospitals.name), asc(hospitals.id));
}

export async function listDepartmentsByHospitalId(hospitalId: number) {
  const db = await resolveDb();
  return db
    .select()
    .from(departments)
    .where(eq(departments.hospitalId, hospitalId))
    .orderBy(asc(departments.name), asc(departments.id));
}

export async function listReferralContactsForAdmin(input?: {
  hospitalId?: number;
}) {
  const db = await resolveDb();
  const whereClause =
    typeof input?.hospitalId === "number" && input.hospitalId > 0
      ? eq(referralContacts.hospitalId, input.hospitalId)
      : undefined;

  return db
    .select()
    .from(referralContacts)
    .where(whereClause)
    .orderBy(
      asc(referralContacts.hospitalId),
      asc(referralContacts.departmentId),
      asc(referralContacts.id)
    );
}

function sanitizeInsertReferralContact(input: UpsertReferralContactValues) {
  return {
    ...input,
    languages: Array.isArray(input.languages) ? input.languages : [],
    specialtyTags: Array.isArray(input.specialtyTags)
      ? input.specialtyTags
      : [],
    updatedAt: new Date(),
  };
}

export async function upsertReferralContact(input: {
  values: UpsertReferralContactValues;
}) {
  const db = await resolveDb();
  const sanitized = sanitizeInsertReferralContact(input.values);

  if (typeof sanitized.id === "number" && sanitized.id > 0) {
    const { id, ...rest } = sanitized;
    await db
      .update(referralContacts)
      .set(rest)
      .where(eq(referralContacts.id, id));

    return getContactById(id);
  }

  const rows = await db
    .insert(referralContacts)
    .values(sanitized)
    .returning({ id: referralContacts.id });

  const contactId = rows[0]?.id;
  return typeof contactId === "number" ? getContactById(contactId) : null;
}

export async function updateReferralContactActive(input: {
  contactId: number;
  isActive: boolean;
}) {
  const db = await resolveDb();
  const result = await db
    .update(referralContacts)
    .set({
      isActive: input.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(referralContacts.id, input.contactId));

  return extractAffectedRows(result);
}

export async function upsertHospital(input: {
  id?: number;
  name: string;
  nameEn?: string;
  city?: string;
  cityEn?: string;
  isActive: boolean;
}) {
  const db = await resolveDb();
  if (typeof input.id === "number" && input.id > 0) {
    await db
      .update(hospitals)
      .set({
        name: input.name,
        nameEn: input.nameEn ?? null,
        city: input.city ?? "上海",
        cityEn: input.cityEn ?? null,
        isActive: input.isActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, input.id));

    return getHospitalById(input.id);
  }

  const rows = await db
    .insert(hospitals)
    .values({
      name: input.name,
      nameEn: input.nameEn ?? null,
      city: input.city ?? "上海",
      cityEn: input.cityEn ?? null,
      isActive: input.isActive ? 1 : 0,
    })
    .returning({ id: hospitals.id });

  const hospitalId = rows[0]?.id;
  return typeof hospitalId === "number" ? getHospitalById(hospitalId) : null;
}

export async function updateHospitalActive(input: {
  hospitalId: number;
  isActive: boolean;
}) {
  const db = await resolveDb();
  const result = await db
    .update(hospitals)
    .set({
      isActive: input.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(hospitals.id, input.hospitalId));

  return extractAffectedRows(result);
}
