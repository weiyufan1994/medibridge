import { eq } from "drizzle-orm";
import {
  appointmentMedicalSummaries,
  type InsertAppointmentMedicalSummary,
} from "../../../drizzle/schema";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";

export async function getMedicalSummaryByAppointmentId(
  appointmentId: number,
  dbExecutor?: AppointmentRepoExecutor
) {
  const db = await resolveAppointmentRepoExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(appointmentMedicalSummaries)
    .where(eq(appointmentMedicalSummaries.appointmentId, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertMedicalSummaryByAppointmentId(input: {
  appointmentId: number;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  source: InsertAppointmentMedicalSummary["source"];
  signedBy?: number | null;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(input.dbExecutor);
  await db
    .insert(appointmentMedicalSummaries)
    .values({
      appointmentId: input.appointmentId,
      chiefComplaint: input.chiefComplaint,
      historyOfPresentIllness: input.historyOfPresentIllness,
      pastMedicalHistory: input.pastMedicalHistory,
      assessmentDiagnosis: input.assessmentDiagnosis,
      planRecommendations: input.planRecommendations,
      source: input.source,
      signedBy: input.signedBy ?? null,
    })
    .onConflictDoUpdate({
      target: appointmentMedicalSummaries.appointmentId,
      set: {
        chiefComplaint: input.chiefComplaint,
        historyOfPresentIllness: input.historyOfPresentIllness,
        pastMedicalHistory: input.pastMedicalHistory,
        assessmentDiagnosis: input.assessmentDiagnosis,
        planRecommendations: input.planRecommendations,
        source: input.source,
        signedBy: input.signedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return getMedicalSummaryByAppointmentId(input.appointmentId, db);
}
