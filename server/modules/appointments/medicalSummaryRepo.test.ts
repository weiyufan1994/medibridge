import { describe, expect, it, vi } from "vitest";
import {
  getMedicalSummaryByAppointmentId,
  upsertMedicalSummaryByAppointmentId,
} from "./medicalSummaryRepo";

function buildExecutor(summaryRows: unknown[]) {
  const limit = vi.fn(async () => summaryRows);
  const values = vi.fn(() => ({
    onConflictDoUpdate: vi.fn(async () => undefined),
  }));

  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
      insert: vi.fn(() => ({ values })),
      update: vi.fn(),
    },
    limit,
    values,
  };
}

describe("appointment medical summary repository", () => {
  it("returns the persisted summary without changing its metadata", async () => {
    const summary = {
      appointmentId: 81,
      chiefComplaint: "Headache",
      source: "doctor_edited",
      signedBy: 17,
    };
    const { executor } = buildExecutor([summary]);

    await expect(
      getMedicalSummaryByAppointmentId(81, executor as never)
    ).resolves.toEqual(summary);
  });

  it("upserts every structured field and returns the stored row", async () => {
    const stored = {
      appointmentId: 82,
      chiefComplaint: "Fever",
      historyOfPresentIllness: "Two days",
      pastMedicalHistory: "None",
      assessmentDiagnosis: "Viral syndrome",
      planRecommendations: "Hydration",
      source: "doctor_edited",
      signedBy: 19,
    };
    const { executor, values } = buildExecutor([stored]);

    const result = await upsertMedicalSummaryByAppointmentId({
      ...stored,
      dbExecutor: executor as never,
    });

    expect(values).toHaveBeenCalledWith(stored);
    expect(result).toEqual(stored);
  });
});
