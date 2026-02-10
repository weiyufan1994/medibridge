import { eq, like, or, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  doctors,
  hospitals,
  departments,
  patientSessions,
  InsertPatientSession,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Search doctors by keywords in expertise, specialty, department, or hospital
 */
export async function searchDoctors(keywords: string[], limit: number = 20) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Build search conditions
  const conditions = keywords.flatMap(keyword => [
    like(doctors.expertise, `%${keyword}%`),
    like(doctors.specialty, `%${keyword}%`),
    like(departments.name, `%${keyword}%`),
    like(hospitals.name, `%${keyword}%`),
  ]);

  const results = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .where(or(...conditions))
    .orderBy(
      desc(sql`case when ${doctors.haodafUrl} is null then 0 else 1 end`),
      desc(doctors.recommendationScore)
    )
    .limit(limit);

  return results;
}

/**
 * Pick 1-2 representative doctors for each department so users can quickly
 * understand what each department treats.
 */
export async function getDepartmentHighlights(
  limitDepartments = 24,
  doctorsPerDepartment = 2
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const candidateRows = await db
    .select({
      doctor: doctors,
      hospital: hospitals,
      department: departments,
    })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id))
    .orderBy(
      departments.name,
      desc(sql`case when ${doctors.haodafUrl} is null then 0 else 1 end`),
      desc(doctors.recommendationScore),
      doctors.id
    )
    .limit(2000);

  const grouped = new Map<
    number,
    {
      department: (typeof candidateRows)[number]["department"];
      hospital: (typeof candidateRows)[number]["hospital"];
      doctors: (typeof candidateRows)[number]["doctor"][];
    }
  >();

  for (const row of candidateRows) {
    const existing = grouped.get(row.department.id);
    if (!existing) {
      if (grouped.size >= limitDepartments) continue;

      grouped.set(row.department.id, {
        department: row.department,
        hospital: row.hospital,
        doctors: [row.doctor],
      });
      continue;
    }

    if (existing.doctors.length >= doctorsPerDepartment) {
      continue;
    }

    existing.doctors.push(row.doctor);
  }

  return Array.from(grouped.values());
}

/**
 * Get doctor by ID with hospital and department info
 */
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

/**
 * Get all hospitals
 */
export async function getAllHospitals() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.select().from(hospitals).orderBy(hospitals.name);
}

/**
 * Get departments by hospital ID
 */
export async function getDepartmentsByHospital(hospitalId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .select()
    .from(departments)
    .where(eq(departments.hospitalId, hospitalId))
    .orderBy(departments.name);
}

/**
 * Get doctors by department ID
 */
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

/**
 * Save or update patient session
 */
export async function upsertPatientSession(session: InsertPatientSession) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select()
    .from(patientSessions)
    .where(eq(patientSessions.sessionId, session.sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(patientSessions)
      .set({
        chatHistory: session.chatHistory,
        symptoms: session.symptoms,
        duration: session.duration,
        age: session.age,
        medicalHistory: session.medicalHistory,
        recommendedDoctors: session.recommendedDoctors,
        updatedAt: new Date(),
      })
      .where(eq(patientSessions.sessionId, session.sessionId));
  } else {
    await db.insert(patientSessions).values(session);
  }
}

/**
 * Get patient session by session ID
 */
export async function getPatientSession(sessionId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const results = await db
    .select()
    .from(patientSessions)
    .where(eq(patientSessions.sessionId, sessionId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}
