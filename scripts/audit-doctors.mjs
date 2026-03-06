import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { doctors, hospitals, departments } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

function looksLikeUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

function isPlaceholder(value) {
  if (!value) return false;
  return ["未知", "暂无", "N/A", "无", "-"].includes(String(value).trim());
}

async function auditDoctors() {
  const rows = await db
    .select({ doctor: doctors, hospital: hospitals, department: departments })
    .from(doctors)
    .innerJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .innerJoin(departments, eq(doctors.departmentId, departments.id));

  const issues = [];
  const duplicateKeys = new Map();

  for (const row of rows) {
    const { doctor, hospital, department } = row;
    const key = `${hospital.name}__${department.name}__${doctor.name}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);

    if (!doctor.name?.trim())
      issues.push({ doctorId: doctor.id, type: "missing_name" });
    if (!department.name?.trim())
      issues.push({ doctorId: doctor.id, type: "missing_department" });
    if (!hospital.name?.trim())
      issues.push({ doctorId: doctor.id, type: "missing_hospital" });

    if (!doctor.expertise && !doctor.specialty) {
      issues.push({ doctorId: doctor.id, type: "missing_expertise" });
    }

    if (
      doctor.recommendationScore != null &&
      (doctor.recommendationScore < 0 || doctor.recommendationScore > 10)
    ) {
      issues.push({
        doctorId: doctor.id,
        type: "invalid_recommendation_score",
        value: doctor.recommendationScore,
      });
    }

    if (doctor.haodafUrl && !looksLikeUrl(doctor.haodafUrl)) {
      issues.push({
        doctorId: doctor.id,
        type: "invalid_haodaf_url",
        value: doctor.haodafUrl,
      });
    }

    if (isPlaceholder(doctor.specialty) || isPlaceholder(doctor.expertise)) {
      issues.push({
        doctorId: doctor.id,
        type: "placeholder_specialty_or_expertise",
      });
    }
  }

  for (const [key, count] of duplicateKeys) {
    if (count > 1) issues.push({ type: "duplicate_doctor_key", key, count });
  }

  console.log("Doctor records audited:", rows.length);
  console.log("Issues found:", issues.length);

  const grouped = issues.reduce((acc, item) => {
    const t = item.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  console.log("Issue summary:");
  for (const [type, count] of Object.entries(grouped)) {
    console.log(`- ${type}: ${count}`);
  }

  if (issues.length > 0) {
    console.log("Sample issues:", JSON.stringify(issues.slice(0, 30), null, 2));
  }

  await connection.end();
}

auditDoctors().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
