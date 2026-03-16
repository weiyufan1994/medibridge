import * as appointmentsRepo from "./repo";
import { resolveBoundDoctorIdForUser } from "../doctorAccounts/actions";
import {
  getAppointmentByIdOrThrow,
  getSessionEmailFromContext,
} from "./accessValidation";
import { parseIntakeFromNotes } from "./accessQueryActions";
import {
  classifyMyAppointments,
  toMyAppointmentItem,
  toPublicAppointment,
} from "./serializers";
import { appointmentIntakeSchema } from "./schemas";
import type { TrpcContext } from "../../_core/context";

export async function listMineAppointments(input: {
  userId: number;
  email: string | null;
  limit: number;
}) {
  const appointmentRows = await appointmentsRepo.listAppointmentsByUserScope({
    userId: input.userId,
    email: input.email,
    limit: input.limit,
  });
  return appointmentRows.map(toPublicAppointment);
}

export async function listMyAppointmentsByContext(ctx: TrpcContext) {
  const userEmail = ctx.user?.email?.trim().toLowerCase();

  let rows: Awaited<ReturnType<typeof appointmentsRepo.listAppointmentsByEmail>> = [];
  if (ctx.user) {
    rows = await appointmentsRepo.listAppointmentsByUserOrEmail({
      userId: ctx.user.id,
      email: userEmail,
    });
  } else {
    const sessionEmail = getSessionEmailFromContext(ctx);
    if (!sessionEmail) {
      return { upcoming: [], completed: [], past: [] };
    }
    rows = await appointmentsRepo.listAppointmentsByEmail(sessionEmail);
  }

  return classifyMyAppointments(rows.map(toMyAppointmentItem));
}

export async function getAppointmentStatus(input: { appointmentId: number }) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return {
    appointmentId: appointment.id,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    stripeSessionId: appointment.stripeSessionId ?? null,
    paidAt: appointment.paidAt ?? null,
  };
}

function extractPackageId(notes: string | null | undefined) {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as { packageId?: unknown };
    return typeof parsed.packageId === "string" ? parsed.packageId : null;
  } catch {
    return null;
  }
}

export async function listDoctorWorkbenchAppointments(input: {
  doctorId?: number;
  limit: number;
  currentUserId: number;
  currentUserRole?: string | null;
}) {
  const doctorId = await resolveBoundDoctorIdForUser({
    userId: input.currentUserId,
    allowAdminDoctorId: input.doctorId,
    userRole: input.currentUserRole,
  });
  const rows = await appointmentsRepo.listAppointmentsByDoctor({
    doctorId,
    limit: input.limit,
  });
  const now = Date.now();

  const items = rows.map(row => {
    const intake = parseIntakeFromNotes(row.notes, value =>
      appointmentIntakeSchema.safeParse(value)
    );

    return {
      id: row.id,
      slotId: row.slotId ?? null,
      doctorId,
      appointmentType: row.appointmentType,
      scheduledAt: row.scheduledAt,
      status: row.status,
      paymentStatus: row.paymentStatus,
      patientEmail: row.email,
      chiefComplaint: intake?.chiefComplaint?.trim() || null,
      packageId: extractPackageId(row.notes),
      createdAt: row.createdAt,
    };
  });

  return {
    upcoming: items.filter(item => {
      const scheduledAt = item.scheduledAt?.getTime() ?? 0;
      return scheduledAt >= now && ["pending_payment", "paid", "active"].includes(item.status);
    }),
    recent: items
      .filter(item => {
        const scheduledAt = item.scheduledAt?.getTime() ?? 0;
        return scheduledAt < now || ["ended", "completed", "canceled", "expired"].includes(item.status);
      })
      .slice(0, 10),
  };
}
