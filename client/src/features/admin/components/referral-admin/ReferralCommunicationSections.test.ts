import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ReferralCommunicationSections } from "./ReferralCommunicationSections";

const testGlobal = globalThis as typeof globalThis & {
  React?: typeof React;
};
const previousReact = testGlobal.React;

beforeAll(() => {
  testGlobal.React = React;
});

afterAll(() => {
  if (previousReact) {
    testGlobal.React = previousReact;
    return;
  }

  Reflect.deleteProperty(testGlobal, "React");
});

function renderSections(
  lang: "en" | "zh",
  options: {
    internalNotes?: Array<{
      id: number;
      note: string;
      createdAt: Date | string;
    }>;
    taskKind?: "assign" | "terminal";
  } = {}
) {
  return renderToStaticMarkup(
    React.createElement(ReferralCommunicationSections, {
      lang,
      taskKind: options.taskKind ?? "assign",
      internalNotes: options.internalNotes ?? [],
      internalNote: "",
      patientProgressUpdate: "",
      contactOutcome: "connected",
      contactNote: "",
      bookingOutcome: "progressing",
      bookingNote: "",
      addNotePending: false,
      publishProgressPending: false,
      contactAttemptPending: false,
      bookingResultPending: false,
      onInternalNoteChange: vi.fn(),
      onPatientProgressChange: vi.fn(),
      onContactOutcomeChange: vi.fn(),
      onContactNoteChange: vi.fn(),
      onBookingOutcomeChange: vi.fn(),
      onBookingNoteChange: vi.fn(),
      onAddNote: vi.fn(),
      onPublishProgress: vi.fn(),
      onRecordContactAttempt: vi.fn(),
      onRecordBookingResult: vi.fn(),
    })
  );
}

describe("ReferralCommunicationSections", () => {
  it.each([
    {
      lang: "zh" as const,
      patientTitle: "添加患者可见备注",
      publishLabel: "发布给患者",
      internalTitle: "内部备注（患者不可见）",
    },
    {
      lang: "en" as const,
      patientTitle: "Add patient-visible note",
      publishLabel: "Publish to patient",
      internalTitle: "Internal note (not visible to patient)",
    },
  ])(
    "makes the patient-visible action primary in $lang",
    ({ lang, patientTitle, publishLabel, internalTitle }) => {
      const markup = renderSections(lang);

      expect(markup).toContain(patientTitle);
      expect(markup).toContain(publishLabel);
      expect(markup).toContain(internalTitle);
      expect(markup.indexOf(patientTitle)).toBeLessThan(
        markup.indexOf(internalTitle)
      );
    }
  );

  it("keeps saved internal notes visible to staff after the order closes", () => {
    const markup = renderSections("zh", {
      taskKind: "terminal",
      internalNotes: [
        {
          id: 8,
          note: "院方已确认收到补充材料",
          createdAt: "2026-08-14T12:00:00.000Z",
        },
      ],
    });

    expect(markup).toContain("内部备注（患者不可见）");
    expect(markup).toContain("院方已确认收到补充材料");
    expect(markup).not.toContain("添加患者可见备注");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("仅供后台人员查看，不会展示给患者。");
  });
});
