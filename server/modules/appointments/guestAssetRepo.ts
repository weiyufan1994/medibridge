import { eq } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function reassignAppointmentsFromGuest(input: {
  guestUserId: number;
  formalUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set({ userId: input.formalUserId })
    .where(eq(appointments.userId, input.guestUserId));
}
