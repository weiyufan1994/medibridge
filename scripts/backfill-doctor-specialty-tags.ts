import "../server/_core/loadEnv";
import { eq } from "drizzle-orm";
import { doctorSpecialtyTags, doctors, departments } from "../drizzle/schema";
import { getDb } from "../server/db";
import { deriveDoctorSpecialtyTags } from "../server/modules/doctors/taxonomy";

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      doctor: doctors,
      department: departments,
    })
    .from(doctors)
    .innerJoin(departments, eq(doctors.departmentId, departments.id));

  let upserted = 0;

  for (const row of rows) {
    const tags = deriveDoctorSpecialtyTags({
      departmentName: row.department.name,
      departmentNameEn: row.department.nameEn,
      specialty: row.doctor.specialty,
      specialtyEn: row.doctor.specialtyEn,
      expertise: row.doctor.expertise,
      expertiseEn: row.doctor.expertiseEn,
    });

    for (const tag of tags) {
      await db
        .insert(doctorSpecialtyTags)
        .values({
          doctorId: row.doctor.id,
          tag,
          source: "rule",
          confidence: 100,
        })
        .onConflictDoUpdate({
          target: [doctorSpecialtyTags.doctorId, doctorSpecialtyTags.tag],
          set: {
            source: "rule",
            confidence: 100,
            updatedAt: new Date(),
          },
        });
      upserted += 1;
    }
  }

  console.log(JSON.stringify({ doctors: rows.length, upserted }, null, 2));
}

main().catch(error => {
  console.error("[backfill-doctor-specialty-tags] failed", error);
  process.exit(1);
});
