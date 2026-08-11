import {
  parseStoredHistoricalTriageResult,
  rebuildHistoricalTriageResultFromSummary,
  TRIAGE_RESULT_FLAG_TYPE,
} from "./historyResult";
import * as repo from "./repo";

export async function getHistoricalTriageResultForUser(input: {
  sessionId: number;
  userId: number;
}) {
  const session = await repo.getAiChatSessionById(input.sessionId);
  if (!session || session.userId !== input.userId) {
    return null;
  }

  const storedResultFlag = await repo.getLatestSessionFlagByType(
    input.sessionId,
    TRIAGE_RESULT_FLAG_TYPE
  );
  const storedResult = parseStoredHistoricalTriageResult(
    storedResultFlag?.flagValue
  );
  const triageResult =
    storedResult ??
    (await rebuildHistoricalTriageResultFromSummary(session.summary));

  return {
    session,
    triageResult,
  };
}
