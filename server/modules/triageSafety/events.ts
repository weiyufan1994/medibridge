import { and, eq } from "drizzle-orm";
import {
  triageRiskEvents,
  triageSessionFlags,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { TriageRiskScanResult } from "./types";

export async function recordRiskEvents(input: {
  sessionId: number;
  messageId?: number | null;
  scanResult: TriageRiskScanResult;
}) {
  const db = await getDb();
  if (!db || input.scanResult.matchedRiskCodes.length === 0) {
    return;
  }

  await db.insert(triageRiskEvents).values(
    input.scanResult.matchedRiskCodes.map(riskCode => ({
      sessionId: input.sessionId,
      messageId: input.messageId ?? null,
      riskCode,
      severity: input.scanResult.highestSeverity ?? "high",
      recommendedAction: input.scanResult.recommendedAction ?? "seek_urgent_care",
      triggerSource: input.scanResult.triggerSource,
      rawExcerpt: input.scanResult.rawExcerpt,
    }))
  );
}

export async function setSessionFlag(input: {
  sessionId: number;
  flagType: string;
  flagValue: string;
}) {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db.insert(triageSessionFlags).values({
    sessionId: input.sessionId,
    flagType: input.flagType,
    flagValue: input.flagValue,
  });
}

export async function clearSessionFlagsByType(sessionId: number, flagType: string) {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db
    .delete(triageSessionFlags)
    .where(
      and(
        eq(triageSessionFlags.sessionId, sessionId),
        eq(triageSessionFlags.flagType, flagType)
      )
    );
}
