import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../_core/getPublicBaseUrl", () => ({
  getPublicBaseUrl: vi.fn(() => "https://medibridge.test"),
}));
vi.mock("./repo", () => ({
  createAppointmentDraft: vi.fn(),
  findLatestAppointmentIdByLookup: vi.fn(),
  insertStatusEvent: vi.fn(),
  markAppointmentPendingPayment: vi.fn(),
}));
vi.mock("../scheduling/publicApi", () => ({
  schedulingSlotApi: {
    attachHeldSlotToAppointment: vi.fn(),
    holdSlot: vi.fn(),
    releaseHeldSlotByAppointmentId: vi.fn(),
  },
}));

import { getDb } from "../../db";
import { schedulingSlotApi as slots } from "../scheduling/publicApi";
import * as repo from "./repo";
import {
  createAppointmentCheckoutFlow,
  resolveCreateInputToStoredEmail,
} from "./checkoutActions";

const selectedPackage = {
  id: "online-30",
  durationMinutes: 30,
  amount: 4900,
  currency: "usd" as const,
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    doctorId: 11,
    triageSessionId: 12,
    appointmentType: "online_chat" as const,
    scheduledAt: new Date("2026-01-10T10:00:00.000Z"),
    email: "patient@example.com",
    userId: 7,
    selectedPackage,
    requestMetadata: {} as never,
    createCheckoutSession: vi.fn().mockResolvedValue({
      provider: "stripe",
      id: "cs_appointment_101",
      url: "https://checkout.test/cs_appointment_101",
    }),
    ...overrides,
  };
}

describe("appointment checkout flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    vi.mocked(repo.insertStatusEvent).mockResolvedValue(undefined as never);
    vi.mocked(repo.markAppointmentPendingPayment).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(slots.releaseHeldSlotByAppointmentId).mockResolvedValue(
      undefined as never
    );
  });

  it("preserves email or normalizes phone into a storage-only address", async () => {
    await expect(
      resolveCreateInputToStoredEmail({ email: "patient@example.com" })
    ).resolves.toBe("patient@example.com");
    await expect(
      resolveCreateInputToStoredEmail({ phone: "+86 (138) 0013-8000" })
    ).resolves.toBe("phone+8613800138000@medibridge.local");
    await expect(
      resolveCreateInputToStoredEmail({ phone: "---" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates a checkout without a slot and serializes package intake", async () => {
    vi.mocked(repo.createAppointmentDraft).mockResolvedValue([
      { insertId: 101 },
    ] as never);
    const result = await createAppointmentCheckoutFlow(
      input({
        intake: {
          chiefComplaint: " headache ",
          duration: " two days ",
        },
      })
    );

    expect(repo.createAppointmentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: JSON.stringify({
          intakeVersion: 2,
          packageId: "online-30",
          packageDurationMinutes: 30,
          chiefComplaint: "headache",
          duration: "two days",
          medicalHistory: "",
          medications: "",
          allergies: "",
          ageGroup: "",
          otherSymptoms: "",
        }),
      })
    );
    expect(repo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 101,
        fromStatus: null,
        toStatus: "draft",
      })
    );
    expect(result).toMatchObject({
      appointmentId: 101,
      slotId: null,
      status: "pending_payment",
      paymentStatus: "pending",
    });
  });

  it("falls back to lookup and rejects an unresolved appointment id", async () => {
    vi.mocked(repo.createAppointmentDraft).mockResolvedValue({} as never);
    vi.mocked(repo.findLatestAppointmentIdByLookup).mockResolvedValueOnce(
      102 as never
    );
    await expect(createAppointmentCheckoutFlow(input())).resolves.toMatchObject(
      {
        appointmentId: 102,
      }
    );

    vi.mocked(repo.findLatestAppointmentIdByLookup).mockResolvedValueOnce(
      null as never
    );
    await expect(createAppointmentCheckoutFlow(input())).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("holds and attaches a slot in one transaction", async () => {
    const tx = { transaction: "executor" };
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (callback: (executor: unknown) => Promise<void>) =>
        callback(tx),
    } as never);
    vi.mocked(slots.holdSlot).mockResolvedValue({ id: 50 } as never);
    vi.mocked(repo.createAppointmentDraft).mockResolvedValue(103 as never);
    vi.mocked(slots.attachHeldSlotToAppointment).mockResolvedValue(
      undefined as never
    );

    await expect(
      createAppointmentCheckoutFlow(
        input({ slotId: 50, sessionId: "session-50" })
      )
    ).resolves.toMatchObject({ appointmentId: 103, slotId: 50 });
    expect(slots.holdSlot).toHaveBeenCalledWith({
      slotId: 50,
      heldBySessionId: "session-50",
      dbExecutor: tx,
    });
    expect(slots.attachHeldSlotToAppointment).toHaveBeenCalledWith({
      slotId: 50,
      appointmentId: 103,
      heldBySessionId: "session-50",
      dbExecutor: tx,
    });
  });

  it("rejects missing storage and unavailable slots before draft creation", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await expect(
      createAppointmentCheckoutFlow(input({ slotId: 50 }))
    ).rejects.toThrow("Database not available");

    vi.mocked(getDb).mockResolvedValueOnce({
      transaction: async (callback: (executor: unknown) => Promise<void>) =>
        callback({}),
    } as never);
    vi.mocked(slots.holdSlot).mockResolvedValueOnce(null as never);
    await expect(
      createAppointmentCheckoutFlow(input({ slotId: 50 }))
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "SLOT_UNAVAILABLE",
    });
  });

  it("releases a held slot after checkout or transition failure", async () => {
    const transactionDb = {
      transaction: async (callback: (executor: unknown) => Promise<void>) =>
        callback({}),
    };
    vi.mocked(getDb).mockResolvedValue(transactionDb as never);
    vi.mocked(slots.holdSlot).mockResolvedValue({ id: 50 } as never);
    vi.mocked(repo.createAppointmentDraft).mockResolvedValue(104 as never);
    vi.mocked(slots.attachHeldSlotToAppointment).mockResolvedValue(
      undefined as never
    );

    vi.mocked(repo.markAppointmentPendingPayment).mockResolvedValueOnce({
      ok: false,
      reason: "conflict",
    } as never);
    await expect(
      createAppointmentCheckoutFlow(input({ slotId: 50 }))
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "APPOINTMENT_INVALID_STATUS_TRANSITION",
    });
    expect(slots.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith({
      appointmentId: 104,
    });

    vi.mocked(repo.markAppointmentPendingPayment).mockResolvedValue({
      ok: true,
    } as never);
    await expect(
      createAppointmentCheckoutFlow(
        input({
          slotId: 50,
          createCheckoutSession: vi
            .fn()
            .mockRejectedValue(new Error("provider down")),
        })
      )
    ).rejects.toThrow("provider down");
    expect(slots.releaseHeldSlotByAppointmentId).toHaveBeenCalledTimes(3);
  });
});
