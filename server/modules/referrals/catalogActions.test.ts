import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminStaffDirectoryApi } from "../admin/publicApi";
import {
  listAssignableAgentsAction,
  listReferralContactsForAdminAction,
  updateHospitalActiveAction,
  upsertContactAction,
} from "./catalogActions";
import * as referralRepo from "./repo";

vi.mock("../admin/publicApi", () => ({
  adminStaffDirectoryApi: { listAssignableStaff: vi.fn() },
}));

vi.mock("./repo", () => ({
  getHospitalById: vi.fn(),
  listReferralContactsForAdmin: vi.fn(),
  updateHospitalActive: vi.fn(),
  upsertReferralContact: vi.fn(),
}));

const contact = {
  id: 31,
  hospitalId: 4,
  departmentId: 5,
  name: "Coordinator",
  roleType: "coordinator",
  languages: ["zh"],
  specialtyTags: ["cardiology"],
  avgResponseTimeMinutes: null,
  successRate: null,
  isActive: 1,
};

describe("referral catalog actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps catalog contacts to the existing public shape", async () => {
    vi.mocked(referralRepo.listReferralContactsForAdmin).mockResolvedValue([
      contact as never,
    ]);

    await expect(
      listReferralContactsForAdminAction({ hospitalId: 4 })
    ).resolves.toEqual([
      {
        id: 31,
        hospitalId: 4,
        departmentId: 5,
        name: "Coordinator",
        roleType: "coordinator",
        languages: ["zh"],
        specialtyTags: ["cardiology"],
        avgResponseTimeMinutes: null,
        successRate: null,
        isActive: true,
      },
    ]);
  });

  it("normalizes optional contact values before persistence", async () => {
    vi.mocked(referralRepo.upsertReferralContact).mockResolvedValue(
      contact as never
    );

    await upsertContactAction({
      hospitalId: 4,
      departmentId: 5,
      name: "Coordinator",
      roleType: "coordinator",
      languages: ["zh"],
      specialtyTags: ["cardiology"],
      isActive: true,
    });

    expect(referralRepo.upsertReferralContact).toHaveBeenCalledWith({
      values: {
        id: undefined,
        hospitalId: 4,
        departmentId: 5,
        name: "Coordinator",
        roleType: "coordinator",
        languages: ["zh"],
        specialtyTags: ["cardiology"],
        avgResponseTimeMinutes: null,
        successRate: null,
        isActive: 1,
        internalNotes: null,
      },
    });
  });

  it("preserves the not-found error when no hospital row is updated", async () => {
    vi.mocked(referralRepo.updateHospitalActive).mockResolvedValue(0);

    await expect(
      updateHospitalActiveAction({ hospitalId: 9, isActive: false })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(referralRepo.getHospitalById).not.toHaveBeenCalled();
  });

  it("delegates assignable staff lookup to the admin public API", async () => {
    const staff = [{ id: 10 }];
    vi.mocked(adminStaffDirectoryApi.listAssignableStaff).mockResolvedValue(
      staff as never
    );

    await expect(listAssignableAgentsAction()).resolves.toEqual(staff);
  });
});
