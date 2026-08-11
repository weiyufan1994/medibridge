import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardAppointmentCopy } from "@/features/dashboard";
import type { MyAppointmentItem } from "./myAppointmentsPresentation";

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  stateValues: [] as unknown[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  stateIndex: 0,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  surfaceText: vi.fn(),
  listUseQuery: vi.fn(),
  tokenUseQuery: vi.fn(),
  doctorUseQuery: vi.fn(),
  listQuery: {
    data: {
      upcoming: [] as MyAppointmentItem[],
      completed: [] as MyAppointmentItem[],
      past: [] as MyAppointmentItem[],
    },
    isLoading: false,
    error: null as Error | null,
  },
  detailQuery: {
    data: undefined as
      | {
          doctorId: number;
          scheduledAt: string;
          medicalSummary: null;
        }
      | undefined,
    isLoading: false,
    error: null as Error | null,
  },
  doctorQuery: {
    data: undefined as
      | { doctor: { name: { zh: string; en: string } } }
      | undefined,
  },
  resendMutation: { mutateAsync: vi.fn() },
  openRoomMutation: { mutateAsync: vi.fn() },
  retryPaymentMutation: { mutateAsync: vi.fn() },
}));

vi.mock("react", () => ({
  default: {
    useMemo: <T>(factory: () => T) => factory(),
    useState: mocks.useState,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/features/appointment", () => ({
  getAppointmentSurfaceText: mocks.surfaceText,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    appointments: {
      listMyAppointments: { useQuery: mocks.listUseQuery },
      resendLink: { useMutation: () => mocks.resendMutation },
      openMyRoom: { useMutation: () => mocks.openRoomMutation },
      getByToken: { useQuery: mocks.tokenUseQuery },
    },
    doctors: {
      getById: { useQuery: mocks.doctorUseQuery },
    },
    payments: {
      createCheckoutSessionForAppointment: {
        useMutation: () => mocks.retryPaymentMutation,
      },
    },
  },
}));

import { useMyAppointmentsController } from "./useMyAppointmentsController";

const copy = getDashboardAppointmentCopy("en");

function appointment(
  id: number,
  status: MyAppointmentItem["status"],
  scheduledAt = `2026-08-${String(id).padStart(2, "0")}T10:00:00.000Z`
): MyAppointmentItem {
  return {
    id,
    doctorId: 7,
    appointmentType: "video_call",
    scheduledAt,
    status,
    paymentStatus: status === "draft" ? "unpaid" : "paid",
    createdAt: scheduledAt,
  };
}

function renderController(stateValues: unknown[] = []) {
  mocks.stateValues = stateValues;
  mocks.stateSetters.length = 0;
  mocks.stateIndex = 0;
  return useMyAppointmentsController({ resolved: "en", copy });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stateValues = [];
  mocks.stateSetters.length = 0;
  mocks.stateIndex = 0;
  mocks.useState.mockImplementation(initial => {
    const index = mocks.stateIndex++;
    const setter = vi.fn();
    mocks.stateSetters.push(setter);
    return [mocks.stateValues[index] ?? initial, setter];
  });
  mocks.listQuery.data = {
    upcoming: [appointment(1, "paid")],
    completed: [appointment(3, "completed")],
    past: [appointment(2, "ended")],
  };
  mocks.listQuery.error = null;
  mocks.detailQuery.data = undefined;
  mocks.detailQuery.error = null;
  mocks.doctorQuery.data = undefined;
  mocks.listUseQuery.mockReturnValue(mocks.listQuery);
  mocks.tokenUseQuery.mockReturnValue(mocks.detailQuery);
  mocks.doctorUseQuery.mockReturnValue(mocks.doctorQuery);
  mocks.surfaceText.mockImplementation(
    ({ value, fallback }: { value?: { en?: string }; fallback: string }) =>
      value?.en ?? fallback
  );
  mocks.retryPaymentMutation.mutateAsync.mockResolvedValue({
    checkoutSessionUrl: "https://pay.example/checkout",
  });
  mocks.openRoomMutation.mutateAsync.mockResolvedValue({
    joinUrl: "https://medibridge.test/visit/1?t=room-token",
  });
  mocks.resendMutation.mutateAsync.mockResolvedValue({ devLink: null });
  vi.stubGlobal("window", {
    location: { href: "", origin: "https://medibridge.test" },
  });
});

describe("useMyAppointmentsController", () => {
  it("preserves default query inputs, sections, and doctor fallback", () => {
    const controller = renderController();

    expect(mocks.listUseQuery).toHaveBeenCalledWith();
    expect(mocks.tokenUseQuery).toHaveBeenCalledWith(
      {
        appointmentId: 1,
        token: "summary-placeholder-token",
        lang: "en",
      },
      { enabled: false, retry: 1 }
    );
    expect(mocks.doctorUseQuery).toHaveBeenCalledWith(
      { id: 0 },
      { enabled: false, retry: 1 }
    );
    expect(controller.upcomingItems.map(item => item.id)).toEqual([1]);
    expect(controller.pastVisitItems.map(item => item.id)).toEqual([3, 2]);
    expect(controller.summaryDoctorName).toBe(
      copy.doctorFallback.replace("{{id}}", "-")
    );
  });

  it("enables summary queries with the exact access context", () => {
    mocks.detailQuery.data = {
      doctorId: 7,
      scheduledAt: "2026-08-11T10:00:00.000Z",
      medicalSummary: null,
    };
    mocks.doctorQuery.data = {
      doctor: { name: { zh: "张医生", en: "Dr. Zhang" } },
    };

    const controller = renderController([
      "past_visits",
      9,
      true,
      { appointmentId: 9, token: "summary-token" },
    ]);

    expect(mocks.tokenUseQuery).toHaveBeenCalledWith(
      { appointmentId: 9, token: "summary-token", lang: "en" },
      { enabled: true, retry: 1 }
    );
    expect(mocks.doctorUseQuery).toHaveBeenCalledWith(
      { id: 7 },
      { enabled: true, retry: 1 }
    );
    expect(controller.activeTab).toBe("past_visits");
    expect(controller.actingAppointmentId).toBe(9);
    expect(controller.summaryModalOpen).toBe(true);
    expect(controller.summaryDoctorName).toBe("Dr. Zhang");
  });

  it("accepts only known tabs", () => {
    const controller = renderController();

    controller.handleTabChange("past_visits");
    controller.handleTabChange("upcoming");
    controller.handleTabChange("unknown");

    expect(mocks.stateSetters[0]).toHaveBeenNthCalledWith(1, "past_visits");
    expect(mocks.stateSetters[0]).toHaveBeenNthCalledWith(2, "upcoming");
    expect(mocks.stateSetters[0]).toHaveBeenCalledTimes(2);
  });

  it.each(["draft", "pending_payment"] as const)(
    "retries checkout for %s appointments",
    async status => {
      const controller = renderController();
      const item = appointment(4, status);

      await controller.handleOpenAccess(item);

      expect(mocks.retryPaymentMutation.mutateAsync).toHaveBeenCalledWith({
        appointmentId: 4,
      });
      expect(window.location.href).toBe("https://pay.example/checkout");
      expect(mocks.stateSetters[1]).toHaveBeenNthCalledWith(1, 4);
      expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
    }
  );

  it.each(["paid", "active", "ended", "completed"] as const)(
    "opens the room for %s appointments",
    async status => {
      const controller = renderController();

      await controller.handleOpenAccess(appointment(5, status));

      expect(mocks.openRoomMutation.mutateAsync).toHaveBeenCalledWith({
        appointmentId: 5,
      });
      expect(window.location.href).toBe(
        "https://medibridge.test/visit/1?t=room-token"
      );
      expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
    }
  );

  it("resends inactive appointment access with dev and email outcomes", async () => {
    mocks.resendMutation.mutateAsync
      .mockResolvedValueOnce({
        devLink: "https://medibridge.test/visit/6?t=dev-token",
      })
      .mockResolvedValueOnce({ devLink: null });
    const controller = renderController();

    await controller.handleOpenAccess(appointment(6, "expired"));
    expect(window.location.href).toBe("/visit/6?t=dev-token");
    await controller.handleOpenAccess(appointment(7, "refunded"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.accessSentEmail);
  });

  it("maps open-access errors and always clears pending state", async () => {
    mocks.openRoomMutation.mutateAsync.mockRejectedValueOnce(
      new Error("APPOINTMENT_NOT_STARTED")
    );
    const controller = renderController();

    await controller.handleOpenAccess(appointment(8, "active"));

    expect(mocks.toastError).toHaveBeenCalledWith(copy.hintNotStarted);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
  });

  it("opens chat history and maps chat failures", async () => {
    const controller = renderController();
    await controller.handleViewChatHistory(appointment(9, "completed"));
    expect(window.location.href).toContain("room-token");

    mocks.openRoomMutation.mutateAsync.mockRejectedValueOnce(
      new Error("APPOINTMENT_NOT_ALLOWED")
    );
    await controller.handleViewChatHistory(appointment(9, "completed"));
    expect(mocks.toastError).toHaveBeenCalledWith(copy.hintInactive);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
  });

  it("opens a medical summary only after extracting its token", async () => {
    const controller = renderController();

    await controller.handleViewMedicalSummary(appointment(10, "completed"));

    expect(mocks.stateSetters[3]).toHaveBeenCalledWith({
      appointmentId: 10,
      token: "room-token",
    });
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(true);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
  });

  it("reports missing medical-summary tokens without opening the modal", async () => {
    mocks.openRoomMutation.mutateAsync.mockResolvedValueOnce({
      joinUrl: "https://medibridge.test/visit/11",
    });
    const controller = renderController();

    await controller.handleViewMedicalSummary(appointment(11, "completed"));

    expect(mocks.toastError).toHaveBeenCalledWith(
      copy.medicalSummaryLoadFailed
    );
    expect(mocks.stateSetters[3]).not.toHaveBeenCalled();
    expect(mocks.stateSetters[2]).not.toHaveBeenCalled();
  });

  it("preserves resend success and error fallbacks", async () => {
    const controller = renderController();

    await controller.handleResend(12);
    expect(mocks.resendMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 12,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.accessSent);

    mocks.resendMutation.mutateAsync.mockRejectedValueOnce(
      new Error("resend failed upstream")
    );
    await controller.handleResend(13);
    expect(mocks.toastError).toHaveBeenCalledWith("resend failed upstream");

    mocks.resendMutation.mutateAsync.mockRejectedValueOnce("unknown");
    await controller.handleResend(14);
    expect(mocks.toastError).toHaveBeenCalledWith(copy.resendFailed);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(null);
  });

  it("keeps summary access while opening and clears it while closing", () => {
    const controller = renderController();

    controller.handleSummaryOpenChange(true);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(true);
    expect(mocks.stateSetters[3]).not.toHaveBeenCalled();

    controller.handleSummaryOpenChange(false);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(false);
    expect(mocks.stateSetters[3]).toHaveBeenCalledWith(null);
  });

  it("does not redirect when browser globals are unavailable", async () => {
    vi.stubGlobal("window", undefined);
    const controller = renderController();

    await controller.handleOpenAccess(appointment(15, "draft"));
    await controller.handleViewChatHistory(appointment(15, "completed"));

    expect(mocks.retryPaymentMutation.mutateAsync).toHaveBeenCalled();
    expect(mocks.openRoomMutation.mutateAsync).toHaveBeenCalled();
  });
});
