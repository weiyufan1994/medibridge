import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  exchangeAppointmentTokenForVisitChat: vi.fn(),
  refreshVisitChatAccessToken: vi.fn(),
  listAppointmentPackages: vi.fn(),
  validateAppointmentToken: vi.fn(),
  revokeAccessTokenByInput: vi.fn(),
  validateAccessTokenContext: vi.fn(),
}));

vi.mock("./modules/appointments/routerApi", async () => {
  const { z } = await import("zod");
  const schemas = await import("./modules/appointments/schemas");
  return {
    appointmentCore: core,
    appointmentActions: new Proxy({}, { get: () => vi.fn() }),
    appointmentSchemas: new Proxy(schemas, {
      get(target, property) {
        return Reflect.get(target, property) ?? z.any();
      },
    }),
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
  resendPaymentLinkForPatient: vi.fn(),
}));

import { appointmentsRouter } from "./routers/appointments";

const requestMetadata = {
  requestId: "visit-chat-router-request",
  clientIp: "203.0.113.20",
  userAgent: "vitest",
};

function caller() {
  return appointmentsRouter.createCaller({
    user: null,
    requestMetadata,
    req: { headers: {} },
    res: {},
  } as never);
}

describe("appointments visit chat token procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const action of [
      core.exchangeAppointmentTokenForVisitChat,
      core.refreshVisitChatAccessToken,
    ]) {
      action.mockResolvedValue({
        token: "signed-visit-chat-token",
        appointmentId: 42,
        role: "patient",
        purpose: "visit_chat",
        expiresAt: new Date("2026-08-13T00:10:00.000Z"),
      });
    }
  });

  it.each([
    ["exchangeVisitChatToken", core.exchangeAppointmentTokenForVisitChat],
    ["refreshVisitChatToken", core.refreshVisitChatAccessToken],
  ] as const)(
    "keeps %s public and delegates validated input",
    async (name, action) => {
      const result = await caller()[name]({
        appointmentId: 42,
        token: "source-token-1234567890",
      });

      expect(action).toHaveBeenCalledWith({
        appointmentId: 42,
        token: "source-token-1234567890",
        requestMetadata,
      });
      expect(result).toMatchObject({
        appointmentId: 42,
        purpose: "visit_chat",
        role: "patient",
      });
    }
  );

  it("rejects malformed exchange input before the action", async () => {
    await expect(
      caller().exchangeVisitChatToken({ appointmentId: 0, token: "short" })
    ).rejects.toThrow();
    expect(core.exchangeAppointmentTokenForVisitChat).not.toHaveBeenCalled();
  });

  it("rejects a response that violates the scoped token contract", async () => {
    core.refreshVisitChatAccessToken.mockResolvedValue({
      token: "signed-visit-chat-token",
      appointmentId: 42,
      role: "patient",
      purpose: "appointment_access",
      expiresAt: new Date(),
    });

    await expect(
      caller().refreshVisitChatToken({
        appointmentId: 42,
        token: "signed-visit-chat-token",
      })
    ).rejects.toThrow();
  });
});
