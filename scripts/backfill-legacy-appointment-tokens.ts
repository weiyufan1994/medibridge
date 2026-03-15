import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { extractAffectedRows } from "../server/_core/dbCompat";

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const patientInsert = await db.execute(sql`
    INSERT INTO appointmentTokens
      (appointmentId, role, tokenHash, expiresAt, revokedAt, createdAt, updatedAt)
    SELECT
      a.id,
      'patient',
      a.accessTokenHash,
      COALESCE(a.accessTokenExpiresAt, a.updatedAt, a.createdAt, NOW()),
      a.accessTokenRevokedAt,
      COALESCE(a.paidAt, a.updatedAt, a.createdAt, NOW()),
      NOW()
    FROM appointments a
    WHERE a.accessTokenHash IS NOT NULL
      AND LENGTH(TRIM(a.accessTokenHash)) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM appointmentTokens t
        WHERE t.appointmentId = a.id
          AND t.role = 'patient'
          AND t.tokenHash = a.accessTokenHash
      )
  `);

  const doctorInsert = await db.execute(sql`
    INSERT INTO appointmentTokens
      (appointmentId, role, tokenHash, expiresAt, revokedAt, createdAt, updatedAt)
    SELECT
      a.id,
      'doctor',
      a.doctorTokenHash,
      COALESCE(a.accessTokenExpiresAt, a.updatedAt, a.createdAt, NOW()),
      a.doctorTokenRevokedAt,
      COALESCE(a.paidAt, a.updatedAt, a.createdAt, NOW()),
      NOW()
    FROM appointments a
    WHERE a.doctorTokenHash IS NOT NULL
      AND LENGTH(TRIM(a.doctorTokenHash)) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM appointmentTokens t
        WHERE t.appointmentId = a.id
          AND t.role = 'doctor'
          AND t.tokenHash = a.doctorTokenHash
      )
  `);

  const patientRows = extractAffectedRows(patientInsert);
  const doctorRows = extractAffectedRows(doctorInsert);

  console.log(
    `[token-backfill] done: patient=${patientRows}, doctor=${doctorRows}, total=${patientRows + doctorRows}`
  );
}

main().catch(error => {
  console.error("[token-backfill] failed", error);
  process.exit(1);
});
