import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  getDb: getDbMock,
}));

import { searchDoctorsByEmbedding } from "./repo";

function createEmbeddingRowsQuery(rows: any[]) {
  const builder: any = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(async () => rows),
    then: (
      resolve: (value: any[]) => unknown,
      reject?: (error: unknown) => unknown
    ) => Promise.resolve(rows).then(resolve, reject),
  };

  return builder;
}

describe("searchDoctorsByEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses JSON embeddings and tolerates dimensional mismatch", async () => {
    const rows = [
      {
        doctor: { id: 1, recommendationScore: 80 },
        hospital: { id: 10 },
        department: { id: 100 },
        embedding: JSON.stringify([1, 0]),
      },
      {
        doctor: { id: 2, recommendationScore: 95 },
        hospital: { id: 10 },
        department: { id: 101 },
        embedding: [0.5, 0.5, 99],
      },
      {
        doctor: { id: 3, recommendationScore: 70 },
        hospital: { id: 10 },
        department: { id: 102 },
        embedding: "invalid-json",
      },
      {
        doctor: { id: 4, recommendationScore: 60 },
        hospital: { id: 10 },
        department: { id: 103 },
        embedding: [0, 0, 0],
      },
    ];

    getDbMock.mockResolvedValue({
      select: vi.fn(() => createEmbeddingRowsQuery(rows)),
    });

    const result = await searchDoctorsByEmbedding([1, 0, 0], 10);

    expect(result.map(item => item.doctor.id)).toEqual([1, 2]);
  });
});
