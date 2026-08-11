import { and, eq } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

export async function markAppointmentInSessionIfNeeded(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const currentStatus = rows[0]?.status;
  if (currentStatus !== "paid") {
    return null;
  }

  const result = await db
    .update(appointments)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.status, currentStatus)
      )
    );

  const affectedRows = extractAffectedRows(result);
  return affectedRows > 0 ? currentStatus : null;
}
