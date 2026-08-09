import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAllHospitals: vi.fn(),
  getDepartmentsByHospital: vi.fn(),
}));

import { doctorDirectoryApi } from "./publicApi";
import * as repo from "./repo";

describe("doctorDirectoryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists hospitals through the doctors-owned repository", async () => {
    vi.mocked(repo.getAllHospitals).mockResolvedValue([]);

    await expect(doctorDirectoryApi.getAllHospitals()).resolves.toEqual([]);
    expect(repo.getAllHospitals).toHaveBeenCalledOnce();
  });

  it("lists departments for the requested hospital", async () => {
    vi.mocked(repo.getDepartmentsByHospital).mockResolvedValue([]);

    await expect(
      doctorDirectoryApi.getDepartmentsByHospital(17)
    ).resolves.toEqual([]);
    expect(repo.getDepartmentsByHospital).toHaveBeenCalledWith(17);
  });
});
