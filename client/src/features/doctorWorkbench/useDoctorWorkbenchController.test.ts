import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationOptions = {
  onSuccess?: () => Promise<void>;
  onError?: (error: Error) => void;
};

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  bindingQuery: {
    data: { activeBinding: { doctorId: 7 } } as {
      activeBinding: { doctorId: number } | null;
    },
    refetch: vi.fn(),
  },
  doctorQuery: {
    data: {
      doctor: {
        id: 7,
        departmentId: 3,
        name: { zh: "张医生", en: "Dr. Zhang" },
      },
    },
  },
  workbenchQuery: {
    data: {
      upcoming: [
        {
          id: 1,
          slotId: 10,
          doctorId: 7,
          appointmentType: "video_call" as const,
          scheduledAt: "2026-08-11T10:00:00.000Z",
          status: "paid",
          paymentStatus: "paid",
          patientEmail: "patient@example.com",
          chiefComplaint: "Headache",
          packageId: null,
          createdAt: "2026-08-10T10:00:00.000Z",
        },
        {
          id: 3,
          slotId: 12,
          doctorId: 7,
          appointmentType: "online_chat" as const,
          scheduledAt: "2026-08-12T10:00:00.000Z",
          status: "active",
          paymentStatus: "paid",
          patientEmail: "active@example.com",
          chiefComplaint: null,
          packageId: null,
          createdAt: "2026-08-10T10:00:00.000Z",
        },
      ],
      recent: [
        {
          id: 2,
          slotId: 11,
          doctorId: 7,
          appointmentType: "in_person" as const,
          scheduledAt: "2026-08-09T10:00:00.000Z",
          status: "ended",
          paymentStatus: "paid",
          patientEmail: "recent@example.com",
          chiefComplaint: null,
          packageId: "package",
          createdAt: "2026-08-08T10:00:00.000Z",
        },
      ],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  },
  slotsQuery: {
    data: [
      {
        id: 20,
        startAt: "2026-08-13T10:00:00.000Z",
        slotDurationMinutes: 30,
        appointmentType: "video_call",
        status: "available",
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  },
  detailQuery: {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  },
  issueLinksMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  startMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  completeMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  startOptions: undefined as MutationOptions | undefined,
  bindingUseQuery: vi.fn(),
  doctorUseQuery: vi.fn(),
  workbenchUseQuery: vi.fn(),
  slotsUseQuery: vi.fn(),
  detailUseQuery: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(factory: () => T) => factory(),
  useState: mocks.useState,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    doctorAccounts: {
      getMyBinding: { useQuery: mocks.bindingUseQuery },
    },
    doctors: {
      getById: { useQuery: mocks.doctorUseQuery },
    },
    appointments: {
      listDoctorWorkbench: { useQuery: mocks.workbenchUseQuery },
      getDoctorWorkbenchAppointmentDetail: {
        useQuery: mocks.detailUseQuery,
      },
      issueAccessLinks: {
        useMutation: () => mocks.issueLinksMutation,
      },
      startDoctorWorkbenchAppointment: {
        useMutation: (options: MutationOptions) => {
          mocks.startOptions = options;
          return mocks.startMutation;
        },
      },
      completeAppointment: {
        useMutation: () => mocks.completeMutation,
      },
    },
    scheduling: {
      listDoctorUpcomingSlots: { useQuery: mocks.slotsUseQuery },
    },
  },
}));

import { useDoctorWorkbenchController } from "./useDoctorWorkbenchController";

const tr = (zh: string, en: string) => en;

function renderController(
  options: Partial<Parameters<typeof useDoctorWorkbenchController>[0]> = {}
) {
  return useDoctorWorkbenchController({
    isCompatRoute: false,
    compatDoctorId: null,
    isAuthenticated: true,
    lang: "en",
    tr,
    ...options,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stateSetters.length = 0;
  mocks.startOptions = undefined;
  mocks.bindingQuery.data = { activeBinding: { doctorId: 7 } };
  mocks.useState.mockImplementation(initial => {
    const setter = vi.fn();
    mocks.stateSetters.push(setter);
    return [initial, setter];
  });
  mocks.bindingUseQuery.mockReturnValue(mocks.bindingQuery);
  mocks.doctorUseQuery.mockReturnValue(mocks.doctorQuery);
  mocks.workbenchUseQuery.mockReturnValue(mocks.workbenchQuery);
  mocks.slotsUseQuery.mockReturnValue(mocks.slotsQuery);
  mocks.detailUseQuery.mockReturnValue(mocks.detailQuery);
  mocks.bindingQuery.refetch.mockResolvedValue(undefined);
  mocks.workbenchQuery.refetch.mockResolvedValue(undefined);
  mocks.slotsQuery.refetch.mockResolvedValue(undefined);
  mocks.detailQuery.refetch.mockResolvedValue(undefined);
  mocks.issueLinksMutation.mutateAsync.mockResolvedValue({
    doctorLink: "https://example.com/visit/1?t=doctor-token",
  });
  mocks.startMutation.mutateAsync.mockResolvedValue(undefined);
  mocks.completeMutation.mutateAsync.mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: { href: "" } });
});

describe("useDoctorWorkbenchController", () => {
  it("keeps query inputs, derived data, and panel state stable", () => {
    const controller = renderController();

    expect(mocks.bindingUseQuery).toHaveBeenCalledWith(undefined, {
      enabled: true,
    });
    expect(mocks.doctorUseQuery).toHaveBeenCalledWith(
      { id: 7 },
      { enabled: true }
    );
    expect(mocks.workbenchUseQuery).toHaveBeenCalledWith(
      { doctorId: undefined, limit: 30 },
      { enabled: true }
    );
    expect(mocks.slotsUseQuery).toHaveBeenCalledWith(
      { doctorId: undefined },
      { enabled: true }
    );
    expect(mocks.detailUseQuery).toHaveBeenCalledWith(
      { appointmentId: 0, doctorId: undefined, lang: "en" },
      { enabled: false }
    );
    expect(controller.doctorName).toBe("Dr. Zhang");
    expect(controller.allAppointments.map(item => item.id)).toEqual([1, 3, 2]);
    expect(controller.upcomingCount).toBe(2);
    expect(controller.slots).toBe(mocks.slotsQuery.data);

    controller.openDetailSheet(3);
    expect(mocks.stateSetters[0]).toHaveBeenCalledWith(3);
    expect(mocks.stateSetters[1]).toHaveBeenCalledWith(true);
  });

  it("preserves start mutation handling and paid room entry", async () => {
    const controller = renderController();

    await controller.startConsultation(1);
    expect(mocks.startMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 1,
      doctorId: undefined,
    });

    await mocks.startOptions?.onSuccess?.();
    expect(mocks.workbenchQuery.refetch).toHaveBeenCalled();
    expect(mocks.detailQuery.refetch).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Consultation started.");
    mocks.startOptions?.onError?.(new Error("start failed"));
    expect(mocks.toastError).toHaveBeenCalledWith("start failed");

    mocks.startMutation.mutateAsync.mockClear();
    await controller.openDoctorRoom(1);
    expect(mocks.startMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.issueLinksMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 1,
    });
    expect(window.location.href).toBe(
      "https://example.com/visit/1?t=doctor-token"
    );

    mocks.startMutation.mutateAsync.mockClear();
    await controller.openDoctorRoom(3);
    expect(mocks.startMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps summary completion, refresh, and error semantics unchanged", async () => {
    const controller = renderController();

    await controller.openSummaryModalFromWorkbench(1);
    expect(mocks.completeMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 1,
      token: "doctor-token",
    });
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith({
      appointmentId: 1,
      token: "doctor-token",
    });
    expect(mocks.bindingQuery.refetch).toHaveBeenCalled();
    expect(mocks.slotsQuery.refetch).toHaveBeenCalled();

    mocks.completeMutation.mutateAsync.mockClear();
    await controller.openSummaryModalFromWorkbench(2);
    expect(mocks.completeMutation.mutateAsync).not.toHaveBeenCalled();

    mocks.completeMutation.mutateAsync.mockRejectedValueOnce(
      new Error("APPOINTMENT_INVALID_STATUS_TRANSITION")
    );
    await controller.openSummaryModalFromWorkbench(3);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith({
      appointmentId: 3,
      token: "doctor-token",
    });

    mocks.stateSetters[2].mockClear();
    mocks.completeMutation.mutateAsync.mockRejectedValueOnce(
      new Error("completion failed")
    );
    await controller.openSummaryModalFromWorkbench(3);
    expect(mocks.stateSetters[2]).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("completion failed");
  });

  it("handles token failures, modal closure, signed refresh, and compat access", async () => {
    const controller = renderController();
    mocks.issueLinksMutation.mutateAsync.mockResolvedValueOnce({
      doctorLink: "not-a-link",
    });

    await controller.openDoctorRoom(2);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to parse doctor room token."
    );

    controller.handleSummaryOpenChange(true);
    expect(mocks.stateSetters[2]).not.toHaveBeenCalled();
    controller.handleSummaryOpenChange(false);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(null);
    controller.handleSummarySigned();
    expect(mocks.workbenchQuery.refetch).toHaveBeenCalled();
    expect(mocks.detailQuery.refetch).toHaveBeenCalledTimes(2);

    const compatController = renderController({
      isCompatRoute: true,
      compatDoctorId: 8,
    });
    expect(compatController.bindingMismatch).toBe(true);
    expect(compatController.effectiveDoctorId).toBe(8);
    expect(mocks.doctorUseQuery).toHaveBeenLastCalledWith(
      { id: 8 },
      { enabled: true }
    );
    expect(mocks.workbenchUseQuery).toHaveBeenLastCalledWith(
      { doctorId: 8, limit: 30 },
      { enabled: false }
    );
  });

  it("disables protected queries when authentication and binding are absent", () => {
    mocks.bindingQuery.data = { activeBinding: null };
    const controller = renderController({ isAuthenticated: false });

    expect(controller.boundDoctorId).toBeNull();
    expect(controller.effectiveDoctorId).toBeNull();
    expect(mocks.doctorUseQuery).toHaveBeenCalledWith(
      { id: 0 },
      { enabled: false }
    );
    expect(mocks.workbenchUseQuery).toHaveBeenCalledWith(
      { doctorId: undefined, limit: 30 },
      { enabled: false }
    );
  });
});
