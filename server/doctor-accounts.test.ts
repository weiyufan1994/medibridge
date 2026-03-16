import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/doctorAccounts/repo", () => ({
  getActiveBindingByDoctorId: vi.fn(),
  getActiveBindingByUserId: vi.fn(),
  getLatestOpenInviteByDoctorAndEmail: vi.fn(),
  clearPendingBindingsByDoctorId: vi.fn(),
  createInvite: vi.fn(),
  updateInviteById: vi.fn(),
  getInviteById: vi.fn(),
  cancelInviteById: vi.fn(),
  getInviteByTokenHash: vi.fn(),
  expireInviteIfNeeded: vi.fn(),
  markInviteAccepted: vi.fn(),
  createBinding: vi.fn(),
  getDoctorAccountStatusByDoctorId: vi.fn(),
}));
vi.mock("./_core/mailer", () => ({
  sendDoctorInviteEmail: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import * as repo from "./modules/doctorAccounts/repo";
import { sendDoctorInviteEmail } from "./_core/mailer";
import { getDb } from "./db";
import {
  claimDoctorInvite,
  getDoctorAccountStatus,
  inviteDoctorAccount,
} from "./modules/doctorAccounts/actions";

describe("doctor account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    } as never);
  });

  it("inviteDoctorAccount creates and emails a claim invite", async () => {
    vi.mocked(repo.getActiveBindingByDoctorId).mockResolvedValue(null);
    vi.mocked(repo.getLatestOpenInviteByDoctorAndEmail).mockResolvedValue(null);
    vi.mocked(repo.clearPendingBindingsByDoctorId).mockResolvedValue(0 as never);
    vi.mocked(repo.createInvite).mockResolvedValue({
      id: 7,
      doctorId: 11,
      email: "doctor@example.com",
      tokenHash: "x".repeat(64),
      status: "sent",
      expiresAt: new Date("2026-03-23T00:00:00.000Z"),
      sentAt: new Date("2026-03-16T00:00:00.000Z"),
      acceptedAt: null,
      createdByUserId: 2,
      claimedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await inviteDoctorAccount({
      doctorId: 11,
      email: "doctor@example.com",
      createdByUserId: 2,
    });

    expect(repo.createInvite).toHaveBeenCalledTimes(1);
    expect(sendDoctorInviteEmail).toHaveBeenCalledTimes(1);
    expect(result.invite).toMatchObject({
      doctorId: 11,
      email: "doctor@example.com",
      status: "sent",
    });
    expect(result.claimUrl).toContain("/doctor/claim?token=");
  });

  it("claimDoctorInvite activates the doctor binding for the invited email", async () => {
    vi.mocked(repo.getInviteByTokenHash).mockResolvedValue({
      id: 7,
      doctorId: 11,
      email: "doctor@example.com",
      tokenHash: "x".repeat(64),
      status: "sent",
      expiresAt: new Date("2026-03-23T00:00:00.000Z"),
      sentAt: new Date("2026-03-16T00:00:00.000Z"),
      acceptedAt: null,
      createdByUserId: 2,
      claimedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(repo.expireInviteIfNeeded).mockImplementation(async invite => invite as never);
    vi.mocked(repo.getActiveBindingByDoctorId).mockResolvedValue(null);
    vi.mocked(repo.getActiveBindingByUserId).mockResolvedValue(null);
    vi.mocked(repo.markInviteAccepted).mockResolvedValue({
      id: 7,
    } as never);
    vi.mocked(repo.createBinding).mockResolvedValue({
      id: 9,
      doctorId: 11,
      userId: 42,
      email: "doctor@example.com",
      status: "active",
      boundAt: new Date("2026-03-16T10:00:00.000Z"),
      revokedAt: null,
      createdByUserId: 2,
      updatedByUserId: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await claimDoctorInvite({
      token: "a".repeat(48),
      userId: 42,
      userEmail: "doctor@example.com",
    });

    expect(repo.markInviteAccepted).toHaveBeenCalledTimes(1);
    expect(repo.createBinding).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      binding: {
        doctorId: 11,
        userId: 42,
        email: "doctor@example.com",
        status: "active",
      },
    });
  });

  it("getDoctorAccountStatus returns latest invite and active binding", async () => {
    vi.mocked(repo.getDoctorAccountStatusByDoctorId).mockResolvedValue({
      activeBinding: {
        id: 1,
        doctorId: 11,
        userId: 42,
        email: "doctor@example.com",
        status: "active",
        boundAt: new Date("2026-03-16T10:00:00.000Z"),
        revokedAt: null,
        createdByUserId: 2,
        updatedByUserId: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      latestInvite: {
        id: 7,
        doctorId: 11,
        email: "doctor@example.com",
        tokenHash: "x".repeat(64),
        status: "accepted",
        expiresAt: new Date("2026-03-23T00:00:00.000Z"),
        sentAt: new Date("2026-03-16T00:00:00.000Z"),
        acceptedAt: new Date("2026-03-16T10:00:00.000Z"),
        createdByUserId: 2,
        claimedByUserId: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    const result = await getDoctorAccountStatus(11);

    expect(result).toMatchObject({
      doctorId: 11,
      activeBinding: {
        doctorId: 11,
        userId: 42,
      },
      latestInvite: {
        id: 7,
        status: "accepted",
      },
    });
  });
});
