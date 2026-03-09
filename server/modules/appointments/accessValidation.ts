import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { TrpcContext } from "../../_core/context";
import * as appointmentsRepo from "./repo";
import type { VisitAccessAction } from "./tokenValidation";
import { validateAppointmentAccessToken } from "./tokenValidation";

export function getSessionEmailFromContext(ctx: TrpcContext): string | null {
  const rawCookieHeader = ctx.req.headers.cookie;
  const cookies = rawCookieHeader ? parseCookieHeader(rawCookieHeader) : {};

  const raw =
    (typeof ctx.req.headers["x-session-email"] === "string"
      ? ctx.req.headers["x-session-email"]
      : undefined) ??
    cookies.sessionEmail ??
    cookies["session-email"] ??
    cookies.email;

  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function getAppointmentByIdOrThrow(appointmentId: number) {
  const appointment = await appointmentsRepo.getAppointmentById(appointmentId);
  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  }

  return appointment;
}

export function assertAppointmentBelongsToCurrentUser(input: {
  appointment: Awaited<ReturnType<typeof getAppointmentByIdOrThrow>>;
  userId: number;
  userEmail: string;
}) {
  const ownerByUserId =
    typeof input.appointment.userId === "number" &&
    input.appointment.userId === input.userId;
  const ownerByEmail =
    input.appointment.email.trim().toLowerCase() === input.userEmail;

  if (!ownerByUserId && !ownerByEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not allowed to access this appointment",
    });
  }
}

export async function validateAppointmentToken(
  appointmentId: number,
  token: string,
  action: VisitAccessAction = "join_room",
  req?: Request
) {
  const validated = await validateAppointmentAccessToken({
    token,
    action,
    expectedAppointmentId: appointmentId,
    req,
  });

  const touchedAt = new Date();

  if (validated.role === "patient") {
    await appointmentsRepo.updateAppointmentById(validated.appointment.id, {
      lastAccessAt: touchedAt,
    });

    return {
      role: "patient" as const,
      appointment: {
        ...validated.appointment,
        lastAccessAt: touchedAt,
      },
    };
  }

  await appointmentsRepo.updateAppointmentById(validated.appointment.id, {
    doctorLastAccessAt: touchedAt,
  });

  return {
    role: "doctor" as const,
    appointment: {
      ...validated.appointment,
      doctorLastAccessAt: touchedAt,
    },
  };
}
