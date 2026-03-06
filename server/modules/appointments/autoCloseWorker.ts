import { and, eq, sql } from "drizzle-orm";
import { appointmentMessages, appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";
import * as appointmentsRepo from "./repo";
import * as visitRepo from "../visit/repo";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const INACTIVITY_WINDOW_MS = 48 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;
const AUTO_CLOSE_SYSTEM_MESSAGE =
  "Consultation auto-closed due to inactivity. 会诊因长时间无活动已自动关闭。";

async function findInactiveActiveAppointmentIds(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "active"),
        eq(appointments.paymentStatus, "paid"),
        sql`coalesce(
          (
            select max(${appointmentMessages.createdAt})
            from ${appointmentMessages}
            where ${appointmentMessages.appointmentId} = ${appointments.id}
          ),
          ${appointments.updatedAt}
        ) < ${cutoff}`
      )
    )
    .limit(BATCH_LIMIT);

  return rows.map(row => row.id);
}

async function autoCloseInactiveAppointments() {
  // Close consultations with no activity for 48 hours:
  // latest message timestamp is preferred, appointments.updatedAt is the fallback.
  const cutoff = new Date(Date.now() - INACTIVITY_WINDOW_MS);
  const candidateIds = await findInactiveActiveAppointmentIds(cutoff);
  if (candidateIds.length === 0) {
    return;
  }

  for (const appointmentId of candidateIds) {
    const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
      appointmentId,
      allowedFrom: ["active"],
      toStatus: "ended",
      toPaymentStatus: "paid",
      operatorType: "system",
      reason: "auto_closed_inactive_48h",
      payloadJson: {
        inactivityCutoff: cutoff.toISOString(),
      },
    });

    if (!transitioned.ok) {
      continue;
    }

    await visitRepo.createMessage({
      appointmentId,
      senderType: "system",
      content: AUTO_CLOSE_SYSTEM_MESSAGE,
      originalContent: AUTO_CLOSE_SYSTEM_MESSAGE,
      translatedContent: AUTO_CLOSE_SYSTEM_MESSAGE,
      sourceLanguage: "auto",
      targetLanguage: "auto",
      translationProvider: "system",
      createdAt: new Date(),
    });
  }
}

export function startAppointmentAutoCloseWorker(options?: {
  intervalMs?: number;
  runOnStart?: boolean;
}) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const runOnStart = options?.runOnStart ?? true;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await autoCloseInactiveAppointments();
    } catch (error) {
      console.warn("[AppointmentAutoCloseWorker] tick failed:", error);
    } finally {
      running = false;
    }
  };

  if (runOnStart) {
    void tick();
  }
  // Background worker: run every hour on the API server process.
  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
