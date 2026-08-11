import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAppointmentTokenCooldownRemainingSeconds: vi.fn(),
}));
vi.mock("./tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));
vi.mock("../../_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));
vi.mock("../doctorAccounts/publicApi", () => ({
  doctorAccountAccessApi: { resolveBoundDoctorIdForUser: vi.fn() },
}));

import { sendMagicLinkEmail } from "../../_core/mailer";
import * as appointmentsRepo from "./repo";
import {
  resendDoctorAccessLinkInDev,
  resendPatientAccessLink,
} from "./accessLinkActions";
import { issueAppointmentAccessLinks } from "./tokenService";

const appointment = {
  id: 202,
  email: "patient@example.com",
  status: "paid",
  paymentStatus: "paid",
} as never;

describe("appointment access link logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(
      appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
    ).mockResolvedValue(0);
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "patient-access-value" },
      doctor: { token: "doctor-access-value" },
      expiresAt: new Date("2026-08-12T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit/202?t=patient-access-value",
      doctorLink: "https://medibridge.test/visit/202?t=doctor-access-value",
    } as never);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps the patient response contract without logging the link", async () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const result = await resendPatientAccessLink({ appointment });

    expect(result.devLink).toBe(
      "https://medibridge.test/visit/202?t=patient-access-value"
    );
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "patient@example.com",
      result.devLink
    );
    const serialized = String(consoleInfo.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-access",
      event: "patient_link_issued",
      appointmentId: 202,
      delivery: "email",
    });
    expect(serialized).not.toContain("patient-access-value");
    expect(serialized).not.toContain("patient@example.com");
  });

  it("keeps the doctor response contract without logging the link", async () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const result = await resendDoctorAccessLinkInDev({
      appointment,
      email: "patient@example.com",
    });

    expect(result.devDoctorLink).toBe(
      "https://medibridge.test/visit/202?t=doctor-access-value"
    );
    const serialized = String(consoleInfo.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-access",
      event: "doctor_link_issued",
      appointmentId: 202,
      delivery: "api_response",
    });
    expect(serialized).not.toContain("doctor-access-value");
    expect(serialized).not.toContain("patient@example.com");
  });
});
