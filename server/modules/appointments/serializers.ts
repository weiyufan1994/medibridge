import { appointments } from "../../../drizzle/schema";

export function toPublicAppointment(appointment: typeof appointments.$inferSelect) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    triageSessionId: appointment.triageSessionId,
    appointmentType: appointment.appointmentType,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    amount: appointment.amount,
    currency: appointment.currency,
    paidAt: appointment.paidAt,
    email: appointment.email,
    sessionId: appointment.sessionId,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    lastAccessAt: appointment.lastAccessAt,
  };
}

export function toMyAppointmentItem(appointment: typeof appointments.$inferSelect) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    appointmentType: appointment.appointmentType,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    createdAt: appointment.createdAt,
  };
}

export type MyAppointmentItem = ReturnType<typeof toMyAppointmentItem>;

export function classifyMyAppointments(items: MyAppointmentItem[]) {
  const upcoming: MyAppointmentItem[] = [];
  const completed: MyAppointmentItem[] = [];
  const past: MyAppointmentItem[] = [];

  for (const item of items) {
    if (item.status === "pending_payment" || item.status === "paid" || item.status === "active") {
      upcoming.push(item);
      continue;
    }

    if (item.status === "ended" || item.status === "completed") {
      completed.push(item);
      continue;
    }

    if (item.status === "expired" || item.status === "refunded" || item.status === "canceled") {
      past.push(item);
      continue;
    }
  }

  return { upcoming, completed, past };
}
