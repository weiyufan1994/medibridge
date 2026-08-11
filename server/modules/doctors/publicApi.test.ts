import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAllHospitals: vi.fn(),
  getDepartmentsByHospital: vi.fn(),
  searchDoctors: vi.fn(),
  searchDoctorsByEmbedding: vi.fn(),
}));

import { doctorDirectoryApi, doctorSearchApi } from "./publicApi";
import * as repo from "./repo";

describe("doctorDirectoryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only stable hospital directory fields", async () => {
    vi.mocked(repo.getAllHospitals).mockResolvedValue([
      {
        id: 17,
        name: "测试医院",
        nameEn: "Test Hospital",
        city: "上海",
        cityEn: "Shanghai",
        contact: "not-public",
      } as never,
    ]);

    await expect(doctorDirectoryApi.getAllHospitals()).resolves.toEqual([
      {
        id: 17,
        name: "测试医院",
        nameEn: "Test Hospital",
        city: "上海",
        cityEn: "Shanghai",
      },
    ]);
    expect(repo.getAllHospitals).toHaveBeenCalledOnce();
  });

  it("returns only stable department directory fields", async () => {
    vi.mocked(repo.getDepartmentsByHospital).mockResolvedValue([
      {
        id: 23,
        hospitalId: 17,
        name: "心内科",
        url: "not-public",
      } as never,
    ]);

    await expect(
      doctorDirectoryApi.getDepartmentsByHospital(17)
    ).resolves.toEqual([{ id: 23, name: "心内科" }]);
    expect(repo.getDepartmentsByHospital).toHaveBeenCalledWith(17);
  });
});

describe("doctorSearchApi", () => {
  it("exposes the owned keyword and embedding searches", () => {
    expect(doctorSearchApi.search).toBe(repo.searchDoctors);
    expect(doctorSearchApi.searchByEmbedding).toBe(
      repo.searchDoctorsByEmbedding
    );
  });
});
