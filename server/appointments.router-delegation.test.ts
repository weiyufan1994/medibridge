import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actions: {
    listMineAppointments: vi.fn(),
    listMyAppointmentsByContext: vi.fn(),
    getAppointmentAccessByTokenWithDefaultIntake: vi.fn(),
    rescheduleByTokenFlow: vi.fn(),
    getJoinInfoByToken: vi.fn(),
    issueAccessLinksForDoctorUserByAppointmentId: vi.fn(),
    openMyRoomForCurrentUserById: vi.fn(),
    cancelAppointmentByPatientById: vi.fn(),
    resendPatientAccessLinkById: vi.fn(),
    resendDoctorAccessLinkInDevById: vi.fn(),
  },
  core: {
    exchangeAppointmentTokenForVisitChat: vi.fn(),
    refreshVisitChatAccessToken: vi.fn(),
    listAppointmentPackages: vi.fn(),
    validateAppointmentToken: vi.fn(),
    validateAccessTokenContext: vi.fn(),
    revokeAccessTokenByInput: vi.fn(),
  },
  resendPaymentLinkForPatient: vi.fn(),
}));

vi.mock("./modules/appointments/routerApi", async () => {
  const { z } = await import("zod");
  return {
    appointmentActions: mocks.actions,
    appointmentCore: mocks.core,
    appointmentSchemas: new Proxy(
      {},
      {
        get: () => z.any(),
      }
    ),
  };
});

vi.mock("./workflows/appointmentBooking/publicApi", () => ({
  createAppointmentCheckout: vi.fn(),
  createAppointmentCheckoutV2: vi.fn(),
}));
vi.mock("./workflows/appointmentMedicalSummary/publicApi", () => ({
  generateMedicalSummaryDraft: vi.fn(),
}));
vi.mock("./workflows/appointmentPayments/publicApi", () => ({
  resendPaymentLinkForPatient: mocks.resendPaymentLinkForPatient,
}));

import { appointmentsRouter } from "./routers/appointments";

const requestMetadata = {
  requestId: "appointments-router-delegation",
  clientIp: "203.0.113.40",
  userAgent: "vitest",
};

function caller(authenticated = true) {
  return appointmentsRouter.createCaller({
    user: authenticated
      ? {
          id: 17,
          openId: "router-user",
          email: "doctor@example.com",
          name: "Router Doctor",
          role: "doctor",
          loginMethod: "test",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          lastSignedIn: new Date("2026-08-01T00:00:00.000Z"),
        }
      : null,
    requestMetadata,
    req: { headers: {} },
    res: {},
  } as never);
}

describe("appointments router delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const action of [
      ...Object.values(mocks.actions),
      mocks.core.validateAccessTokenContext,
      mocks.core.revokeAccessTokenByInput,
      mocks.resendPaymentLinkForPatient,
    ]) {
      action.mockResolvedValue({ ok: true });
    }
  });

  it("delegates authenticated and contextual appointment queries", async () => {
    mocks.actions.listMineAppointments.mockResolvedValue([]);
    mocks.actions.listMyAppointmentsByContext.mockResolvedValue({
      upcoming: [],
      completed: [],
      past: [],
    });

    await caller().listMine({ limit: 12 });
    await caller(false).listMyAppointments();

    expect(mocks.actions.listMineAppointments).toHaveBeenCalledWith({
      userId: 17,
      email: "doctor@example.com",
      limit: 12,
    });
    expect(mocks.actions.listMyAppointmentsByContext).toHaveBeenCalledWith(
      expect.objectContaining({ user: null, requestMetadata })
    );
  });

  it("delegates payment resend and patient cancellation metadata", async () => {
    await caller(false).resendPaymentLink({ appointmentId: 41 });
    await caller(false).cancel({ appointmentId: 42, reason: "duplicate" });

    expect(mocks.resendPaymentLinkForPatient).toHaveBeenCalledWith({
      appointmentId: 41,
      operatorId: null,
      requestMetadata,
    });
    expect(mocks.actions.cancelAppointmentByPatientById).toHaveBeenCalledWith({
      appointmentId: 42,
      operatorId: null,
      reason: "duplicate",
    });
  });

  it("delegates token reads and rescheduling with request metadata", async () => {
    await caller(false).getByToken({
      appointmentId: 43,
      token: "patient-token",
      lang: "en",
    });
    await caller(false).rescheduleByToken({
      appointmentId: 43,
      token: "patient-token",
      newScheduledAt: new Date("2026-09-01T10:00:00.000Z"),
    });
    await caller(false).joinInfoByToken({
      appointmentId: 43,
      token: "patient-token",
    });

    expect(
      mocks.actions.getAppointmentAccessByTokenWithDefaultIntake
    ).toHaveBeenCalledWith({
      appointmentId: 43,
      token: "patient-token",
      lang: "en",
      requestMetadata,
    });
    expect(mocks.actions.rescheduleByTokenFlow).toHaveBeenCalledWith({
      appointmentId: 43,
      token: "patient-token",
      newScheduledAt: new Date("2026-09-01T10:00:00.000Z"),
      requestMetadata,
    });
    expect(mocks.actions.getJoinInfoByToken).toHaveBeenCalledWith({
      appointmentId: 43,
      token: "patient-token",
      requestMetadata,
    });
  });

  it("binds protected room actions to the authenticated user", async () => {
    await caller().issueAccessLinks({ appointmentId: 44 });
    await caller().openMyRoom({ appointmentId: 45 });

    expect(
      mocks.actions.issueAccessLinksForDoctorUserByAppointmentId
    ).toHaveBeenCalledWith({
      appointmentId: 44,
      userId: 17,
      userRole: "doctor",
    });
    expect(mocks.actions.openMyRoomForCurrentUserById).toHaveBeenCalledWith({
      appointmentId: 45,
      userId: 17,
      userEmail: "doctor@example.com",
    });
  });

  it("delegates validation, revocation, and resend inputs exactly", async () => {
    await caller(false).validateAccessToken({ token: "access-token" });
    await caller().revokeAccessToken({
      appointmentId: 46,
      role: "patient",
      token: "access-token",
      revokeReason: "manual review",
    });
    await caller(false).resendLink({ appointmentId: 47 });
    await caller(false).resendDoctorLink({
      appointmentId: 48,
      email: "doctor@example.com",
    });

    expect(mocks.core.validateAccessTokenContext).toHaveBeenCalledWith({
      token: "access-token",
      requestMetadata,
    });
    expect(mocks.core.revokeAccessTokenByInput).toHaveBeenCalledWith({
      appointmentId: 46,
      role: "patient",
      token: "access-token",
      revokeReason: "manual review",
    });
    expect(mocks.actions.resendPatientAccessLinkById).toHaveBeenCalledWith({
      appointmentId: 47,
    });
    expect(mocks.actions.resendDoctorAccessLinkInDevById).toHaveBeenCalledWith({
      appointmentId: 48,
      email: "doctor@example.com",
    });
  });
});
