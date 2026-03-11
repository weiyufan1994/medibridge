import { TRPCError } from "@trpc/server";
import { appointments } from "../../../drizzle/schema";
import { sendMagicLinkEmail } from "../../_core/mailer";
import { setCachedPatientAccessToken } from "./tokenCache";
import { buildAppointmentAccessLink } from "./linkService";
import * as appointmentsRepo from "./repo";
import { issueAppointmentAccessLinks } from "./tokenService";
import {
  assertAppointmentBelongsToCurrentUser,
  getAppointmentByIdOrThrow,
} from "./accessValidation";

const TOKEN_RESEND_COOLDOWN_MS = 60_000;
const RESEND_ALLOWED_STATUS = new Set<string>(["paid", "active"]);
const OPEN_ROOM_ALLOWED_STATUS = new Set<string>([
  "paid",
  "active",
  "ended",
  "completed",
]);

type AppointmentRecord = typeof appointments.$inferSelect;

function isVisitRoomTestModeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const raw = (process.env.VISIT_ROOM_TEST_MODE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function hasConsultationStarted(scheduledAt: Date | null, now: Date) {
  if (isVisitRoomTestModeEnabled()) {
    return true;
  }
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    return true;
  }
  return now.getTime() >= scheduledAt.getTime();
}

function getDevAppointmentAccessLink(appointmentId: number, token: string): string {
  return `http://localhost:3000/visit/${appointmentId}?t=${encodeURIComponent(token)}`;
}

async function assertResendCooldown(input: {
  appointmentId: number;
  role: appointmentsRepo.AppointmentTokenRole;
}) {
  const remainingSeconds =
    await appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds({
      appointmentId: input.appointmentId,
      role: input.role,
      cooldownSeconds: Math.floor(TOKEN_RESEND_COOLDOWN_MS / 1000),
    });

  if (remainingSeconds <= 0) {
    return;
  }

  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Please wait ${remainingSeconds} seconds before resending again`,
  });
}

export async function openMyRoomWithFreshLink(input: {
  appointment: AppointmentRecord;
  userId: number;
}) {
  const { appointment, userId } = input;
  const now = new Date();

  if (!OPEN_ROOM_ALLOWED_STATUS.has(appointment.status)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cannot open room when appointment status is ${appointment.status}`,
    });
  }
  if (appointment.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot open visit room before payment is completed",
    });
  }
  if (!hasConsultationStarted(appointment.scheduledAt, now)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "APPOINTMENT_NOT_STARTED",
    });
  }

  const issued = await issueAppointmentAccessLinks({
    appointmentId: appointment.id,
    createdBy: `self_open_room:${userId}`,
  });

  return {
    appointmentId: appointment.id,
    joinUrl: buildAppointmentAccessLink({
      appointmentId: appointment.id,
      token: issued.patient.token,
    }),
  };
}

export async function openMyRoomForCurrentUser(input: {
  appointment: AppointmentRecord;
  userId: number;
  userEmail?: string | null;
}) {
  const userEmail = input.userEmail?.trim().toLowerCase();
  if (!userEmail) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please bind an email before opening appointment room",
    });
  }

  assertAppointmentBelongsToCurrentUser({
    appointment: input.appointment,
    userId: input.userId,
    userEmail,
  });

  return openMyRoomWithFreshLink({
    appointment: input.appointment,
    userId: input.userId,
  });
}

export async function issueAccessLinksForAppointment(input: {
  appointment: AppointmentRecord;
  createdBy: string;
}) {
  const { appointment, createdBy } = input;

  const issued = await issueAppointmentAccessLinks({
    appointmentId: appointment.id,
    createdBy,
  });

  setCachedPatientAccessToken(
    appointment.id,
    issued.patient.token,
    issued.expiresAt
  );

  return {
    appointmentId: appointment.id,
    patientLink: issued.patientLink,
    doctorLink: issued.doctorLink,
    expiresAt: issued.expiresAt,
  };
}

export async function issueAccessLinksForAppointmentById(input: {
  appointmentId: number;
  createdBy: string;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return issueAccessLinksForAppointment({
    appointment,
    createdBy: input.createdBy,
  });
}

export async function resendPatientAccessLink(input: {
  appointment: AppointmentRecord;
}) {
  const { appointment } = input;

  if (appointment.status === "expired") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot resend link for expired appointment",
    });
  }

  if (appointment.status === "refunded") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot resend link for refunded appointment",
    });
  }
  if (
    appointment.status === "canceled" ||
    appointment.status === "ended" ||
    appointment.status === "completed"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot resend link for closed appointment",
    });
  }

  if (appointment.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot resend visit link before payment is completed",
    });
  }

  if (!RESEND_ALLOWED_STATUS.has(appointment.status)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cannot resend link when appointment status is ${appointment.status}`,
    });
  }

  await assertResendCooldown({
    appointmentId: appointment.id,
    role: "patient",
  });

  const issued = await issueAppointmentAccessLinks({
    appointmentId: appointment.id,
    createdBy: "resend_link",
  });

  setCachedPatientAccessToken(
    appointment.id,
    issued.patient.token,
    issued.expiresAt
  );
  const link = issued.patientLink;
  await sendMagicLinkEmail(appointment.email, link);
  if (process.env.NODE_ENV === "development") {
    console.log("DEV ACCESS LINK:");
    console.log(getDevAppointmentAccessLink(appointment.id, issued.patient.token));
  }

  return {
    ok: true as const,
    devLink: process.env.NODE_ENV === "development" ? link : undefined,
  };
}

export async function resendPatientAccessLinkById(input: {
  appointmentId: number;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return resendPatientAccessLink({ appointment });
}

export async function resendDoctorAccessLinkInDev(input: {
  appointment: AppointmentRecord;
  email: string;
}) {
  const { appointment, email } = input;

  if (process.env.NODE_ENV !== "development") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Resending doctor link is only enabled in development",
    });
  }

  if (appointment.email.toLowerCase() !== email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Email does not match appointment",
    });
  }

  if (appointment.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot resend visit link before payment is completed",
    });
  }

  await assertResendCooldown({
    appointmentId: appointment.id,
    role: "doctor",
  });

  const issued = await issueAppointmentAccessLinks({
    appointmentId: appointment.id,
    createdBy: "resend_doctor_link",
  });

  const doctorLink = issued.doctorLink;
  console.log(`[Appointments][DEV] Doctor link: ${doctorLink}`);

  return {
    ok: true as const,
    devDoctorLink: doctorLink,
  };
}

export async function resendDoctorAccessLinkInDevById(input: {
  appointmentId: number;
  email: string;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return resendDoctorAccessLinkInDev({
    appointment,
    email: input.email,
  });
}

export async function openMyRoomForCurrentUserById(input: {
  appointmentId: number;
  userId: number;
  userEmail?: string | null;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return openMyRoomForCurrentUser({
    appointment,
    userId: input.userId,
    userEmail: input.userEmail,
  });
}
