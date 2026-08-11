import { eq } from "drizzle-orm";
import { appointmentVisitSummaries } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function getVisitSummaryByAppointmentId(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointmentVisitSummaries)
    .where(eq(appointmentVisitSummaries.appointmentId, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertVisitSummary(input: {
  appointmentId: number;
  summaryZh: string;
  summaryEn: string;
  source: "llm" | "fallback";
  generatedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .insert(appointmentVisitSummaries)
    .values({
      appointmentId: input.appointmentId,
      summaryZh: input.summaryZh,
      summaryEn: input.summaryEn,
      source: input.source,
      generatedBy: input.generatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: appointmentVisitSummaries.appointmentId,
      set: {
        summaryZh: input.summaryZh,
        summaryEn: input.summaryEn,
        source: input.source,
        generatedBy: input.generatedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return getVisitSummaryByAppointmentId(input.appointmentId);
}
