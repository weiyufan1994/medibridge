import { appointments } from "../../../drizzle/schema";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";

export async function createAppointmentDraft(input: {
  slotId?: number | null;
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  email: string;
  amount: number;
  currency: string;
  userId?: number | null;
  sessionId?: string;
  notes?: string | null;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(input.dbExecutor);

  const rows = await db
    .insert(appointments)
    .values({
      slotId: input.slotId ?? null,
      doctorId: input.doctorId,
      triageSessionId: input.triageSessionId,
      appointmentType: input.appointmentType,
      scheduledAt: input.scheduledAt,
      status: "draft",
      paymentStatus: "unpaid",
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      userId: input.userId ?? null,
      sessionId: input.sessionId,
      notes: input.notes ?? null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
    })
    .returning({ id: appointments.id });

  return rows[0]?.id ?? null;
}
