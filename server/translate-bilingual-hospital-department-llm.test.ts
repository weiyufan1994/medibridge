import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import {
  translateDepartment,
  translateDepartmentBatch,
  translateDepartmentNameOnly,
  translateHospital,
  translateHospitalBatch,
} from "../scripts/translate-bilingual-hospital-department-llm";

describe("bilingual hospital and department LLM adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the selected model and hospital single schema", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              nameEn: "Hospital",
              cityEn: "Shanghai",
              levelEn: "Grade III Class A",
              addressEn: "Address",
              descriptionEn: "Description",
            }),
          },
        },
      ],
    } as never);

    await expect(
      translateHospital(
        {
          name: "医院",
          city: "上海",
          level: "三级甲等",
          address: "地址",
          description: "简介",
        },
        "translation-model"
      )
    ).resolves.toMatchObject({ nameEn: "Hospital", cityEn: "Shanghai" });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        response_format: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "hospital_translation",
          }),
        }),
      })
    );
  });

  it("preserves hospital batch schema, token limit, and parser", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  id: 1,
                  sourceHash: "hash-1",
                  nameEn: "Hospital",
                  cityEn: "Shanghai",
                  levelEn: null,
                  addressEn: null,
                  descriptionEn: null,
                },
              ],
            }),
          },
        },
      ],
    } as never);

    const result = await translateHospitalBatch(
      [
        {
          id: 1,
          sourceHash: "hash-1",
          name: "医院",
          city: "上海",
          level: null,
          address: null,
          description: null,
        },
      ],
      "translation-model"
    );

    expect(result.items.get("hash-1")?.nameEn).toBe("Hospital");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        max_tokens: 4096,
        response_format: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "hospital_batch_translation",
          }),
        }),
      })
    );
  });

  it("preserves department single and name-only schemas", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nameEn: "Department of Cardiology",
                descriptionEn: "Description",
              }),
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ nameEn: "Department of Cardiology" }),
            },
          },
        ],
      } as never);

    await translateDepartment(
      { name: "心内科", description: "简介" },
      "translation-model"
    );
    await expect(
      translateDepartmentNameOnly("心内科", "translation-model")
    ).resolves.toBe("Department of Cardiology");

    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]).toMatchObject({
      model: "translation-model",
      response_format: {
        json_schema: { name: "department_translation" },
      },
    });
    expect(vi.mocked(invokeLLM).mock.calls[1]?.[0]).toMatchObject({
      model: "translation-model",
      response_format: {
        json_schema: { name: "department_name_translation" },
      },
    });
  });

  it("preserves department batch schema and token limit", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  id: 2,
                  sourceHash: "hash-2",
                  nameEn: "Department of Cardiology",
                  descriptionEn: null,
                },
              ],
            }),
          },
        },
      ],
    } as never);

    const result = await translateDepartmentBatch(
      [
        {
          id: 2,
          sourceHash: "hash-2",
          name: "心内科",
          description: null,
        },
      ],
      "translation-model"
    );

    expect(result.items.get("hash-2")?.nameEn).toBe("Department of Cardiology");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        max_tokens: 2048,
        response_format: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "department_batch_translation",
          }),
        }),
      })
    );
  });
});
