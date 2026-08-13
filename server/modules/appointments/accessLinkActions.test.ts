import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tokenCache", () => ({
  setCachedPatientAccessToken: vi.fn(),
}));

vi.mock("./linkService", () => ({
  buildAppointmentAccessLink: vi.fn(),
}));

vi.mock("./repo", () => ({
  getAppointmentTokenCooldownRemainingSeconds: vi.fn(),
}));

vi.mock("./tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));

vi.mock("../doctorAccounts/publicApi", () => ({
  doctorAccountAccessApi: {
    resolveBoundDoctorIdForUser: vi.fn(),
  },
}));

vi.mock("./accessValidation", () => ({
  assertAppointmentBelongsToCurrentUser: vi.fn(),
  getAppointmentByIdOrThrow: vi.fn(),
}));

import { doctorAccountAccessApi as doctorAccess } from "../doctorAccounts/publicApi";
import {
  assertAppointmentBelongsToCurrentUser,
  getAppointmentByIdOrThrow,
} from "./accessValidation";
import {
  issueAccessLinksForAppointment,
  issueAccessLinksForAppointmentById,
  issueAccessLinksForDoctorUserByAppointmentId,
  openMyRoomForCurrentUser,
  openMyRoomForCurrentUserById,
  openMyRoomWithFreshLink,
} from "./accessLinkActions";
import { buildAppointmentAccessLink } from "./linkService";
import { setCachedPatientAccessToken } from "./tokenCache";
import { issueAppointmentAccessLinks } from "./tokenService";

const now = new Date("2026-08-13T10:00:00.000Z");
const expiresAt = new Date("2026-08-14T10:00:00.000Z");
const issuedLinks = {
  patient: { token: "patient-token" },
  doctor: { token: "doctor-token" },
  patientLink: "https://medibridge.test/visit/41?t=patient-token",
  doctorLink: "https://medibridge.test/visit/41?t=doctor-token",
  expiresAt,
};

function createAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    doctorId: 17,
    userId: 9,
    email: "patient@example.com",
    status: "paid",
    paymentStatus: "paid",
    scheduledAt: new Date("2026-08-13T09:00:00.000Z"),
    ...overrides,
  } as never;
}

describe("appointment access link actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue(
      issuedLinks as never
    );
    vi.mocked(buildAppointmentAccessLink).mockReturnValue(
      issuedLinks.patientLink
    );
    vi.mocked(doctorAccess.resolveBoundDoctorIdForUser).mockResolvedValue(17);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("opening the patient room", () => {
    it.each(["draft", "pending_payment", "canceled"])(
      "rejects status %s before issuing a token",
      async status => {
        await expect(
          openMyRoomWithFreshLink({
            appointment: createAppointment({ status }),
            userId: 9,
          })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });

        expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
      }
    );

    it("rejects an unpaid appointment", async () => {
      await expect(
        openMyRoomWithFreshLink({
          appointment: createAppointment({ paymentStatus: "pending" }),
          userId: 9,
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Cannot open visit room before payment is completed",
      });
    });

    it("rejects a future consultation", async () => {
      await expect(
        openMyRoomWithFreshLink({
          appointment: createAppointment({
            scheduledAt: new Date("2026-08-13T11:00:00.000Z"),
          }),
          userId: 9,
        })
      ).rejects.toMatchObject({ message: "APPOINTMENT_NOT_STARTED" });
    });

    it.each(["1", "true", "yes", "on"])(
      "allows a future consultation in development test mode %s",
      async testMode => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("VISIT_ROOM_TEST_MODE", testMode);

        await expect(
          openMyRoomWithFreshLink({
            appointment: createAppointment({
              scheduledAt: new Date("2026-08-13T11:00:00.000Z"),
            }),
            userId: 9,
          })
        ).resolves.toMatchObject({ appointmentId: 41 });
      }
    );

    it("never enables room test mode in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VISIT_ROOM_TEST_MODE", "true");

      await expect(
        openMyRoomWithFreshLink({
          appointment: createAppointment({
            scheduledAt: new Date("2026-08-13T11:00:00.000Z"),
          }),
          userId: 9,
        })
      ).rejects.toMatchObject({ message: "APPOINTMENT_NOT_STARTED" });
    });

    it("issues a fresh patient join link after the consultation starts", async () => {
      await expect(
        openMyRoomWithFreshLink({
          appointment: createAppointment({ scheduledAt: null }),
          userId: 9,
        })
      ).resolves.toEqual({
        appointmentId: 41,
        joinUrl: issuedLinks.patientLink,
      });

      expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
        appointmentId: 41,
        createdBy: "self_open_room:9",
      });
      expect(buildAppointmentAccessLink).toHaveBeenCalledWith({
        appointmentId: 41,
        token: "patient-token",
      });
    });

    it("requires a bound email before checking ownership", async () => {
      await expect(
        openMyRoomForCurrentUser({
          appointment: createAppointment(),
          userId: 9,
          userEmail: "   ",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

      expect(assertAppointmentBelongsToCurrentUser).not.toHaveBeenCalled();
    });

    it("normalizes email and verifies ownership before opening", async () => {
      const appointment = createAppointment();

      await openMyRoomForCurrentUser({
        appointment,
        userId: 9,
        userEmail: "  PATIENT@Example.COM ",
      });

      expect(assertAppointmentBelongsToCurrentUser).toHaveBeenCalledWith({
        appointment,
        userId: 9,
        userEmail: "patient@example.com",
      });
    });

    it("loads an appointment before opening by id", async () => {
      const appointment = createAppointment();
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(appointment);

      await openMyRoomForCurrentUserById({
        appointmentId: 41,
        userId: 9,
        userEmail: "patient@example.com",
      });

      expect(getAppointmentByIdOrThrow).toHaveBeenCalledWith(41);
    });
  });

  describe("issuing access links", () => {
    it("caches and returns both appointment access links", async () => {
      const appointment = createAppointment();

      await expect(
        issueAccessLinksForAppointment({ appointment, createdBy: "payment" })
      ).resolves.toEqual({
        appointmentId: 41,
        patientLink: issuedLinks.patientLink,
        doctorLink: issuedLinks.doctorLink,
        expiresAt,
      });

      expect(setCachedPatientAccessToken).toHaveBeenCalledWith(
        41,
        "patient-token",
        expiresAt
      );
    });

    it("loads an appointment before issuing links by id", async () => {
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );

      await issueAccessLinksForAppointmentById({
        appointmentId: 41,
        createdBy: "admin",
      });

      expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
        appointmentId: 41,
        createdBy: "admin",
      });
    });

    it("rejects a doctor whose binding does not own the appointment", async () => {
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );
      vi.mocked(doctorAccess.resolveBoundDoctorIdForUser).mockResolvedValue(18);

      await expect(
        issueAccessLinksForDoctorUserByAppointmentId({
          appointmentId: 41,
          userId: 77,
          userRole: "doctor",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
    });

    it("issues links for the bound doctor", async () => {
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );

      await issueAccessLinksForDoctorUserByAppointmentId({
        appointmentId: 41,
        userId: 77,
        userRole: "doctor",
      });

      expect(doctorAccess.resolveBoundDoctorIdForUser).toHaveBeenCalledWith({
        userId: 77,
        userRole: "doctor",
      });
      expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
        appointmentId: 41,
        createdBy: "doctor:77",
      });
    });
  });
});
