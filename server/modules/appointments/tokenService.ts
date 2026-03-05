import { hashToken } from "../../_core/appointmentToken";
import * as appointmentsRepo from "./repo";
import { generateToken } from "../../_core/appointmentToken";
import { buildAppointmentAccessLink } from "./linkService";

export type AppointmentAccessRole = "patient" | "doctor";

const DEFAULT_TOKEN_TTL_HOURS = 24;
const DEFAULT_PATIENT_MAX_USES = 1;
const DEFAULT_DOCTOR_MAX_USES = 20;

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function getAppointmentTokenTtlHours(): number {
  return readNumberEnv("APPOINTMENT_TOKEN_TTL_HOURS", DEFAULT_TOKEN_TTL_HOURS);
}

export function getRoleMaxUses(role: AppointmentAccessRole): number {
  if (role === "doctor") {
    return readNumberEnv("APPOINTMENT_DOCTOR_TOKEN_MAX_USES", DEFAULT_DOCTOR_MAX_USES);
  }
  return readNumberEnv("APPOINTMENT_PATIENT_TOKEN_MAX_USES", DEFAULT_PATIENT_MAX_USES);
}

export function getTokenAutoRevokeThreshold(): number {
  return readNumberEnv("APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES", 30);
}

export function generateAppointmentAccessToken(): { token: string; tokenHash: string } {
  const token = generateToken();
  return {
    token,
    tokenHash: hashToken(token),
  };
}

export async function createAccessTokenRecord(input: {
  appointmentId: number;
  role: AppointmentAccessRole;
  expiresAt?: Date;
  maxUses?: number;
  createdBy?: string | null;
  dbExecutor?: appointmentsRepo.AppointmentRepoExecutor;
}) {
  const now = new Date();
  const ttlHours = getAppointmentTokenTtlHours();
  const expiresAt =
    input.expiresAt ?? new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const maxUses = input.maxUses ?? getRoleMaxUses(input.role);

  const { token, tokenHash } = generateAppointmentAccessToken();
  await appointmentsRepo.createAppointmentTokenIfMissing({
    appointmentId: input.appointmentId,
    role: input.role,
    tokenHash,
    expiresAt,
    maxUses,
    createdBy: input.createdBy ?? "system",
    dbExecutor: input.dbExecutor,
  });

  return {
    token,
    tokenHash,
    expiresAt,
    maxUses,
  };
}

export async function issueAppointmentAccessLinks(input: {
  appointmentId: number;
  createdBy?: string | null;
  patientMaxUses?: number;
  doctorMaxUses?: number;
  dbExecutor?: appointmentsRepo.AppointmentRepoExecutor;
}) {
  // 策略：每次签发时撤销旧 token，再签发新 token，避免旧链接长期可用。
  await appointmentsRepo.revokeAppointmentTokens({
    appointmentId: input.appointmentId,
    reason: "reissued",
    dbExecutor: input.dbExecutor,
  });

  const patient = await createAccessTokenRecord({
    appointmentId: input.appointmentId,
    role: "patient",
    maxUses: input.patientMaxUses,
    createdBy: input.createdBy,
    dbExecutor: input.dbExecutor,
  });
  const doctor = await createAccessTokenRecord({
    appointmentId: input.appointmentId,
    role: "doctor",
    maxUses: input.doctorMaxUses,
    createdBy: input.createdBy,
    dbExecutor: input.dbExecutor,
  });

  return {
    patient,
    doctor,
    expiresAt: patient.expiresAt,
    patientLink: buildAppointmentAccessLink(patient.token),
    doctorLink: buildAppointmentAccessLink(doctor.token),
  };
}
