import { describe, expect, it } from "vitest";
import { getHospitalImageCardPresentation } from "@/features/admin/components/HospitalImageManagementCard";

describe("getHospitalImageCardPresentation", () => {
  it("uses english-safe hospital title and city when available", () => {
    expect(
      getHospitalImageCardPresentation({
        lang: "en",
        hospital: {
          name: { zh: "仁济医院", en: "Renji Hospital" },
          city: { zh: "上海", en: "Shanghai" },
        },
      })
    ).toEqual({
      title: "Renji Hospital",
      city: "Shanghai",
      imageAlt: "Renji Hospital",
    });
  });

  it("uses a placeholder title, omits the city row, and falls back to a generic english image alt when english content is unsafe", () => {
    expect(
      getHospitalImageCardPresentation({
        lang: "en",
        hospital: {
          name: { zh: "仁济医院", en: "仁济医院" },
          city: { zh: "上海", en: "" },
        },
      })
    ).toEqual({
      title: "Translation in progress",
      city: "",
      imageAlt: "Hospital cover image",
    });
  });

  it("keeps zh display unchanged", () => {
    expect(
      getHospitalImageCardPresentation({
        lang: "zh",
        hospital: {
          name: { zh: "仁济医院", en: "Renji Hospital" },
          city: { zh: "上海", en: "Shanghai" },
        },
      })
    ).toEqual({
      title: "仁济医院",
      city: "上海",
      imageAlt: "仁济医院",
    });
  });
});
