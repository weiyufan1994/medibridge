import { and, eq, isNull } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

export async function updateAppointmentNotesIfMatch(input: {
  appointmentId: number;
  expectedNotes: string | null;
  nextNotes: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const expectedClause =
    input.expectedNotes === null
      ? isNull(appointments.notes)
      : eq(appointments.notes, input.expectedNotes);

  const result = await db
    .update(appointments)
    .set({
      notes: input.nextNotes,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, input.appointmentId), expectedClause));

  return extractAffectedRows(result);
}
