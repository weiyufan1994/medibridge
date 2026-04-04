import { describe, expect, it } from "vitest";
import {
  buildDepartmentDoctorsInput,
  buildHospitalDepartmentsInput,
  buildHospitalsListInput,
  getHospitalBrowseText,
  matchesHospitalCityFilter,
} from "@/features/hospitals/presentation";

describe("hospitals presentation", () => {
  it("threads the resolved locale through all hospital browsing query inputs", () => {
    expect(buildHospitalsListInput("en")).toEqual({ lang: "en" });
    expect(buildHospitalDepartmentsInput(10, "zh")).toEqual({
      hospitalId: 10,
      lang: "zh",
    });
    expect(buildDepartmentDoctorsInput(100, "en")).toEqual({
      departmentId: 100,
      limit: 50,
      lang: "en",
    });
  });

  it("uses a strict english selector instead of leaking chinese fallback text", () => {
    expect(
      getHospitalBrowseText({
        lang: "en",
        value: { zh: "示例医院", en: "" },
      })
    ).toBe("Translation in progress");

    expect(
      getHospitalBrowseText({
        lang: "en",
        value: { zh: "骨科", en: "骨科" },
      })
    ).toBe("Translation in progress");
  });

  it("keeps chinese display text intact in zh mode", () => {
    expect(
      getHospitalBrowseText({
        lang: "zh",
        value: { zh: "示例医院", en: "Example Hospital" },
      })
    ).toBe("示例医院");
  });

  it("keeps shanghai hospitals visible in english mode even when city translation is missing", () => {
    const city = { zh: "上海", en: "" };

    expect(
      getHospitalBrowseText({
        lang: "en",
        value: city,
      })
    ).toBe("Translation in progress");
    expect(matchesHospitalCityFilter({ city, filter: "上海" })).toBe(true);
  });
});
