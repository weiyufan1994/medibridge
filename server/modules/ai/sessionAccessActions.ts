import * as repo from "./repo";

export type TriageSessionSnapshot = {
  id: number;
  userId: number | null;
  status: "active" | "completed";
  summary: string | null;
};

export async function createTriageSessionForUser(
  userId: number
): Promise<number> {
  return repo.createAiChatSession(userId);
}

export async function getTriageSessionSnapshotById(
  sessionId: number
): Promise<TriageSessionSnapshot | null> {
  const session = await repo.getAiChatSessionById(sessionId);
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    summary: session.summary,
  };
}
