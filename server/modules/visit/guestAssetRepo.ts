import { eq } from "drizzle-orm";
import { appointmentMessages, patientSessions } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function reassignVisitAssetsFromGuest(input: {
  guestUserId: number;
  formalUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(patientSessions)
    .set({ userId: input.formalUserId })
    .where(eq(patientSessions.userId, input.guestUserId));

  await db
    .update(appointmentMessages)
    .set({ userId: input.formalUserId })
    .where(eq(appointmentMessages.userId, input.guestUserId));
}
