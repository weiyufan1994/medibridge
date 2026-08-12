import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  listAppointmentsForAdmin: vi.fn(),
}));
vi.mock("./modules/doctors/repo", () => ({
  getHospitalById: vi.fn(),
  setHospitalImageUrl: vi.fn(),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import * as doctorsRepo from "./modules/doctors/repo";
import { storagePut } from "./storage";
import { systemRouter } from "./routers/system";

function createCaller(role: "admin" | "ops") {
  return systemRouter.createCaller({
    user: { id: 99, role },
    req: { headers: {} },
  } as never);
}

describe("system router representative output contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps admin export result shape stable", async () => {
    vi.mocked(appointmentsRepo.listAppointmentsForAdmin).mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
      items: [],
      riskSummary: {
        total: 0,
        pendingPaymentTimeout: 0,
        webhookFailure: 0,
        tokenExpiringSoon: 0,
        tokenUsageExhausted: 0,
      },
    });

    const result = await createCaller("ops").adminExport({
      scope: "appointments",
      format: "json",
    });

    expect(result).toEqual({
      scope: "appointments",
      format: "json",
      filename: expect.stringMatching(
        /^admin-appointments-\d{4}-\d{2}-\d{2}\.json$/
      ),
      mimeType: "application/json",
      content: "[]",
    });
  });

  it("keeps hospital image result shape stable", async () => {
    vi.mocked(doctorsRepo.getHospitalById).mockResolvedValue({
      id: 10,
    } as never);
    vi.mocked(storagePut).mockResolvedValue({
      key: "hospitals/10/image.png",
      url: "https://cdn.example.test/hospitals/10/image.png",
    });
    vi.mocked(doctorsRepo.setHospitalImageUrl).mockResolvedValue(undefined);

    const result = await createCaller("admin").adminUploadHospitalImage({
      hospitalId: 10,
      imageBase64: "aW1hZ2U=",
      fileName: "image.png",
      contentType: "image/png",
    });

    expect(result).toEqual({
      hospitalId: 10,
      imageUrl: "https://cdn.example.test/hospitals/10/image.png",
    });
    expect(doctorsRepo.setHospitalImageUrl).toHaveBeenCalledWith(
      10,
      "https://cdn.example.test/hospitals/10/image.png"
    );
  });
});
