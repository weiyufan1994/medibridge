import { eq } from "drizzle-orm";
import { aiChatSessions } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function reassignTriageSessionsFromGuest(input: {
  guestUserId: number;
  formalUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(aiChatSessions)
    .set({ userId: input.formalUserId })
    .where(eq(aiChatSessions.userId, input.guestUserId));
}
