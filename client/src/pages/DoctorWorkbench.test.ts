import { describe, expect, it } from "vitest";
import {
  buildDoctorWorkbenchSummaryModalCopy,
  countSignedDoctorWorkbenchAppointments,
  formatDoctorWorkbenchDateTime,
  getDoctorWorkbenchAppointmentTypeLabel,
  getDoctorWorkbenchHeading,
  getDoctorWorkbenchStatusLabel,
  maskDoctorWorkbenchEmail,
  normalizeDoctorWorkbenchError,
  parseDoctorWorkbenchToken,
} from "@/features/doctorWorkbench";
import { getVisitCopy } from "@/features/visit";

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

describe("doctor workbench presentation", () => {
  it("maps visit copy into the medical summary modal contract", () => {
    const visitCopy = getVisitCopy("en");
    expect(buildDoctorWorkbenchSummaryModalCopy(visitCopy)).toMatchObject({
      title: visitCopy.reviewMedicalSummaryTitle,
      aiDisclaimer: visitCopy.medicalSummaryAIDisclaimer,
      signText: visitCopy.medicalSummarySign,
      signSuccessText: visitCopy.consultationEndedSuccess,
      signFailedText: visitCopy.medicalSummarySignFailed,
    });
  });

  it("counts ended and completed appointments as signed summaries", () => {
    expect(
      countSignedDoctorWorkbenchAppointments([
        { status: "paid" },
        { status: "active" },
        { status: "ended" },
        { status: "completed" },
      ])
    ).toBe(2);
  });

  it("masks valid emails while preserving malformed values", () => {
    expect(maskDoctorWorkbenchEmail("alice@example.com")).toBe(
      "a***e@example.com"
    );
    expect(maskDoctorWorkbenchEmail("ab@example.com")).toBe("a*@example.com");
    expect(maskDoctorWorkbenchEmail("not-an-email")).toBe("not-an-email");
  });

  it("resolves known labels and preserves unknown backend values", () => {
    expect(getDoctorWorkbenchStatusLabel("paid", "en")).toBe("Ready");
    expect(getDoctorWorkbenchStatusLabel("custom", "zh")).toBe("custom");
    expect(getDoctorWorkbenchAppointmentTypeLabel("video_call", "zh")).toBe(
      "视频问诊"
    );
    expect(getDoctorWorkbenchAppointmentTypeLabel("custom", "en")).toBe(
      "custom"
    );
  });

  it("parses either supported doctor token query parameter", () => {
    expect(
      parseDoctorWorkbenchToken("https://example.com/visit/1?t=primary")
    ).toBe("primary");
    expect(
      parseDoctorWorkbenchToken("https://example.com/visit/1?token=compat")
    ).toBe("compat");
    expect(parseDoctorWorkbenchToken("not-a-url")).toBeNull();
  });

  it("uses meaningful errors and safe formatting fallbacks", () => {
    expect(normalizeDoctorWorkbenchError(new Error("failed"), "fallback")).toBe(
      "failed"
    );
    expect(normalizeDoctorWorkbenchError(new Error(" "), "fallback")).toBe(
      "fallback"
    );
    expect(formatDoctorWorkbenchDateTime(null, "en-US")).toBe("-");
    expect(formatDoctorWorkbenchDateTime("invalid", "en-US")).toBe("-");
  });
});
