import { eq } from "drizzle-orm";
import { appointments, type InsertAppointment } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function updateAppointmentById(
  appointmentId: number,
  update: Partial<InsertAppointment>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set(update)
    .where(eq(appointments.id, appointmentId));
}
