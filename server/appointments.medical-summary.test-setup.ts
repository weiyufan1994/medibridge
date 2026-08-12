import { vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  createAppointmentDraft: vi.fn(),
  findLatestAppointmentIdByLookup: vi.fn(),
  markAppointmentPendingPayment: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  insertStatusEvent: vi.fn(),
  getAppointmentById: vi.fn(),
  getMedicalSummaryByAppointmentId: vi.fn(),
  upsertMedicalSummaryByAppointmentId: vi.fn(),
  getAppointmentTokenCooldownRemainingSeconds: vi.fn(),
  updateAppointmentById: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
  listAppointmentsByDoctor: vi.fn(),
}));
vi.mock("./modules/scheduling/publicApi", () => ({
  schedulingSlotApi: {
    getSlotById: vi.fn(),
    holdSlot: vi.fn(),
    attachHeldSlotToAppointment: vi.fn(),
    releaseHeldSlotByAppointmentId: vi.fn(),
  },
}));
vi.mock("./modules/doctorAccounts/publicApi", () => ({
  doctorAccountAccessApi: { resolveBoundDoctorIdForUser: vi.fn() },
}));
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));
vi.mock("./modules/appointments/tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));
const appointmentTokenValidationMocks = vi.hoisted(() => ({
  validateAppointmentAccessToken: vi.fn(),
  revokeAppointmentAccessToken: vi.fn(),
}));
vi.mock(
  "./modules/appointments/tokenValidation",
  () => appointmentTokenValidationMocks
);
vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));
vi.mock("./modules/ai/publicApi", () => ({
  aiTriageSessionApi: { getById: vi.fn(), createForUser: vi.fn() },
}));
vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./modules/payments/publicApi", () => ({
  paymentProviderApi: { createCheckoutSession: vi.fn() },
}));
import * as appointmentsRepo from "./modules/appointments/repo";
import { aiTriageSessionApi } from "./modules/ai/publicApi";
import { doctorAccountAccessApi } from "./modules/doctorAccounts/publicApi";
import { schedulingSlotApi } from "./modules/scheduling/publicApi";
import * as visitRepo from "./modules/visit/repo";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { paymentProviderApi } from "./modules/payments/publicApi";
import { sendMagicLinkEmail } from "./_core/mailer";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import {
  appointmentsRouter,
  validateAppointmentToken,
} from "./routers/appointments";

export function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "guest_openid",
      name: null,
      email: "user@example.com",
      isGuest: 1,
      deviceId: "device_1",
      loginMethod: "guest",
      role: "free",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-03-01T00:00:00.000Z"),
    },
    userId: 1,
    deviceId: "device_1",
    requestMetadata: {
      clientIp: "127.0.0.1",
      forwardedHost: null,
      forwardedProto: null,
      host: "medibridge.test",
      protocol: "https",
      requestId: "appointments-test",
      userAgent: "vitest",
    },
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
      get: (name: string) =>
        name.toLowerCase() === "host" ? "medibridge.test" : undefined,
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

export function mockAppointmentAccessValidation(value: unknown) {
  appointmentTokenValidationMocks.validateAppointmentAccessToken.mockResolvedValue(
    value as never
  );
}

export function resetAppointmentTestState() {
  vi.clearAllMocks();
  process.env.NODE_ENV = "development";
  process.env.APP_BASE_URL = "https://medibridge.test";
  vi.mocked(
    appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
  ).mockResolvedValue(0 as never);
  vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
    patient: { token: "patient-token" },
    doctor: { token: "doctor-token" },
    expiresAt: new Date("2026-03-05T00:00:00.000Z"),
    patientLink: "https://medibridge.test/visit/202?t=patient-token",
    doctorLink: "https://medibridge.test/visit/202?t=doctor-token",
  } as never);
  mockAppointmentAccessValidation({
    appointmentId: 303,
    role: "patient",
    tokenId: 1,
    tokenHash: "a".repeat(64),
    expiresAt: new Date("2026-03-05T00:00:00.000Z"),
    displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
    appointment: {
      id: 303,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "paid",
      paymentStatus: "paid",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "user@example.com",
      sessionId: null,
      userId: 1,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_paid",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
  } as never);

  vi.mocked(aiTriageSessionApi.getById).mockResolvedValue({
    id: 99,
    userId: 1,
    status: "completed",
    summary: null,
  });
  vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([] as never);

  vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
    id: "cs_test_abc",
    url: "https://checkout.mock/cs_test_abc",
    provider: "stripe",
  } as never);
  vi.mocked(getDb).mockResolvedValue({
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({}),
  } as never);
  vi.mocked(schedulingSlotApi.getSlotById).mockResolvedValue({
    id: 501,
    doctorId: 11,
    appointmentType: "online_chat",
    slotDurationMinutes: 60,
    timezone: "Asia/Shanghai",
    localDate: "2026-03-03",
    startAt: new Date("2026-03-03T09:00:00.000Z"),
    endAt: new Date("2026-03-03T10:00:00.000Z"),
    status: "open",
    source: "manual",
    scheduleRuleId: null,
    holdExpiresAt: null,
    heldBySessionId: null,
    appointmentId: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  } as never);
  vi.mocked(schedulingSlotApi.holdSlot).mockResolvedValue({
    id: 501,
    doctorId: 11,
    appointmentType: "online_chat",
    slotDurationMinutes: 60,
    timezone: "Asia/Shanghai",
    localDate: "2026-03-03",
    startAt: new Date("2026-03-03T09:00:00.000Z"),
    endAt: new Date("2026-03-03T10:00:00.000Z"),
    status: "held",
    source: "manual",
    scheduleRuleId: null,
    holdExpiresAt: new Date("2026-03-01T00:10:00.000Z"),
    heldBySessionId: "session_1",
    appointmentId: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  } as never);
  vi.mocked(schedulingSlotApi.attachHeldSlotToAppointment).mockResolvedValue({
    id: 501,
  } as never);
  vi.mocked(
    doctorAccountAccessApi.resolveBoundDoctorIdForUser
  ).mockResolvedValue(11);
}
