import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getActiveBindingByUserId: vi.fn(),
}));

import * as repo from "./repo";
import { doctorAccountAccessApi } from "./publicApi";

describe("doctorAccountAccessApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the doctor id from the active account binding", async () => {
    vi.mocked(repo.getActiveBindingByUserId).mockResolvedValue({
      doctorId: 41,
    } as never);

    await expect(
      doctorAccountAccessApi.resolveBoundDoctorIdForUser({
        userId: 7,
        userRole: "doctor",
      })
    ).resolves.toBe(41);
    expect(repo.getActiveBindingByUserId).toHaveBeenCalledWith(7);
  });

  it("allows an admin or operator to select an explicit doctor", async () => {
    await expect(
      doctorAccountAccessApi.resolveBoundDoctorIdForUser({
        userId: 2,
        userRole: "ops",
        allowAdminDoctorId: 53,
      })
    ).resolves.toBe(53);
    expect(repo.getActiveBindingByUserId).not.toHaveBeenCalled();
  });

  it("ignores an explicit doctor selection for a non-admin account", async () => {
    vi.mocked(repo.getActiveBindingByUserId).mockResolvedValue({
      doctorId: 41,
    } as never);

    await expect(
      doctorAccountAccessApi.resolveBoundDoctorIdForUser({
        userId: 7,
        userRole: "doctor",
        allowAdminDoctorId: 53,
      })
    ).resolves.toBe(41);
    expect(repo.getActiveBindingByUserId).toHaveBeenCalledWith(7);
  });

  it("preserves the forbidden error when no active binding exists", async () => {
    vi.mocked(repo.getActiveBindingByUserId).mockResolvedValue(null);

    await expect(
      doctorAccountAccessApi.resolveBoundDoctorIdForUser({
        userId: 9,
        userRole: "doctor",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Doctor workbench is not enabled for the current account",
    });
  });
});
