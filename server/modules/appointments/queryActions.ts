import * as appointmentsRepo from "./repo";
import {
  getAppointmentByIdOrThrow,
  getSessionEmailFromContext,
} from "./accessValidation";
import {
  classifyMyAppointments,
  toMyAppointmentItem,
  toPublicAppointment,
} from "./serializers";
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
