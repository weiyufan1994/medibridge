import { eq } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function bindAppointmentsToUserByEmail(
  email: string,
  userId: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set({ userId })
    .where(eq(appointments.email, email));
}
