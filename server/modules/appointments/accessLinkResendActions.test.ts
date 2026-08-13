import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./tokenCache", () => ({
  setCachedPatientAccessToken: vi.fn(),
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

import { sendMagicLinkEmail } from "../../_core/mailer";
import { getAppointmentByIdOrThrow } from "./accessValidation";
import {
  resendDoctorAccessLinkInDev,
  resendDoctorAccessLinkInDevById,
  resendPatientAccessLink,
  resendPatientAccessLinkById,
} from "./accessLinkActions";
import * as appointmentsRepo from "./repo";
import { setCachedPatientAccessToken } from "./tokenCache";
import { issueAppointmentAccessLinks } from "./tokenService";

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

describe("appointment access link resend actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue(
      issuedLinks as never
    );
    vi.mocked(
      appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
    ).mockResolvedValue(0);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("patient access", () => {
    it.each([
      ["expired", "Cannot resend link for expired appointment"],
      ["refunded", "Cannot resend link for refunded appointment"],
      ["canceled", "Cannot resend link for closed appointment"],
      ["ended", "Cannot resend link for closed appointment"],
      ["completed", "Cannot resend link for closed appointment"],
    ])("rejects %s appointments", async (status, message) => {
      await expect(
        resendPatientAccessLink({
          appointment: createAppointment({ status }),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN", message });
    });

    it("rejects unpaid and otherwise unsupported appointments", async () => {
      await expect(
        resendPatientAccessLink({
          appointment: createAppointment({ paymentStatus: "pending" }),
        })
      ).rejects.toMatchObject({
        message: "Cannot resend visit link before payment is completed",
      });
      await expect(
        resendPatientAccessLink({
          appointment: createAppointment({ status: "draft" }),
        })
      ).rejects.toMatchObject({
        message: "Cannot resend link when appointment status is draft",
      });
    });

    it("enforces the patient resend cooldown before issuing", async () => {
      vi.mocked(
        appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
      ).mockResolvedValue(30);

      await expect(
        resendPatientAccessLink({ appointment: createAppointment() })
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "Please wait 30 seconds before resending again",
      });

      expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
    });

    it("emails and caches a new patient link without exposing it in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      await expect(
        resendPatientAccessLink({ appointment: createAppointment() })
      ).resolves.toEqual({ ok: true, devLink: undefined });

      expect(
        appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
      ).toHaveBeenCalledWith({
        appointmentId: 41,
        role: "patient",
        cooldownSeconds: 60,
      });
      expect(setCachedPatientAccessToken).toHaveBeenCalledWith(
        41,
        "patient-token",
        expiresAt
      );
      expect(sendMagicLinkEmail).toHaveBeenCalledWith(
        "patient@example.com",
        issuedLinks.patientLink
      );
    });

    it("loads an appointment before resending by id", async () => {
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );

      await resendPatientAccessLinkById({ appointmentId: 41 });

      expect(getAppointmentByIdOrThrow).toHaveBeenCalledWith(41);
    });
  });

  describe("doctor access in development", () => {
    it("rejects production, mismatched email, and unpaid access", async () => {
      vi.stubEnv("NODE_ENV", "production");
      await expect(
        resendDoctorAccessLinkInDev({
          appointment: createAppointment(),
          email: "patient@example.com",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      vi.stubEnv("NODE_ENV", "development");
      await expect(
        resendDoctorAccessLinkInDev({
          appointment: createAppointment(),
          email: "other@example.com",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        resendDoctorAccessLinkInDev({
          appointment: createAppointment({ paymentStatus: "pending" }),
          email: "patient@example.com",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("enforces doctor cooldown and returns a fresh development link", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.mocked(appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds)
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(0);

      await expect(
        resendDoctorAccessLinkInDev({
          appointment: createAppointment(),
          email: "patient@example.com",
        })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

      await expect(
        resendDoctorAccessLinkInDev({
          appointment: createAppointment(),
          email: "patient@example.com",
        })
      ).resolves.toEqual({
        ok: true,
        devDoctorLink: issuedLinks.doctorLink,
      });
      expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
        appointmentId: 41,
        createdBy: "resend_doctor_link",
      });
    });

    it("loads an appointment before resending by id", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );

      await resendDoctorAccessLinkInDevById({
        appointmentId: 41,
        email: "patient@example.com",
      });

      expect(getAppointmentByIdOrThrow).toHaveBeenCalledWith(41);
    });
  });
});
