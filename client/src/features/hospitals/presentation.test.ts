import { describe, expect, it } from "vitest";
import {
  buildDoctorDetailInput,
  buildDepartmentDoctorsInput,
  buildHospitalDepartmentsInput,
  buildHospitalsListInput,
  filterHospitalBrowseItems,
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
    expect(buildDoctorDetailInput(42, "en")).toEqual({
      id: 42,
      lang: "en",
    });
    expect(buildDepartmentDoctorsInput(100, "en")).toEqual({
      departmentId: 100,
      limit: 50,
      lang: "en",
    });
  });

  it("uses a strict english selector instead of leaking chinese fallback text on doctor detail surfaces", () => {
    expect(
      getHospitalBrowseText({
        lang: "en",
        value: { zh: "张医生", en: "" },
      })
    ).toBe("Translation in progress");

    expect(
      getHospitalBrowseText({
        lang: "en",
        value: { zh: "主任医师", en: "主任医师" },
      })
    ).toBe("Translation in progress");

    expect(
      getHospitalBrowseText({
        lang: "en",
        value: { zh: "上海市徐汇区示例路 1 号", en: "" },
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

  it("filters hospital cards by city and localized display text", () => {
    const hospitals = [
      {
        id: 1,
        name: { zh: "瑞金医院", en: "Ruijin Hospital" },
        city: { zh: "上海", en: "Shanghai" },
        level: { zh: "三级甲等", en: "Tertiary" },
        imageUrl: null,
      },
      {
        id: 2,
        name: { zh: "北京医院", en: "Beijing Hospital" },
        city: { zh: "北京", en: "Beijing" },
        level: { zh: "三级甲等", en: "Tertiary" },
        imageUrl: null,
      },
    ];

    expect(
      filterHospitalBrowseItems({
        hospitals,
        cityFilter: "上海",
        searchQuery: " RUIJIN ",
        lang: "en",
      }).map(hospital => hospital.id)
    ).toEqual([1]);
  });
});
