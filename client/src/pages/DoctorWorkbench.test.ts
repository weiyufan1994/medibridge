import { describe, expect, it } from "vitest";
import { getDoctorWorkbenchHeading } from "@/pages/DoctorWorkbench";

const tr = (zh: string, en: string) => en;

describe("getDoctorWorkbenchHeading", () => {
  it("uses the english doctor name when it is present and english-safe", () => {
    expect(
      getDoctorWorkbenchHeading({
        lang: "en",
        doctorName: { zh: "张医生", en: "Dr. Zhang" },
        tr,
      })
    ).toBe("Dr. Zhang");
  });

  it("uses the existing english fallback instead of chinese when english is missing or unsafe", () => {
    expect(
      getDoctorWorkbenchHeading({
        lang: "en",
        doctorName: { zh: "张医生", en: "" },
        tr,
      })
    ).toBe("Doctor Workbench");

    expect(
      getDoctorWorkbenchHeading({
        lang: "en",
        doctorName: { zh: "张医生", en: "张医生" },
        tr,
      })
    ).toBe("Doctor Workbench");
  });

  it("keeps chinese display unchanged in zh mode", () => {
    expect(
      getDoctorWorkbenchHeading({
        lang: "zh",
        doctorName: { zh: "张医生", en: "Dr. Zhang" },
        tr,
      })
    ).toBe("张医生");
  });
});
