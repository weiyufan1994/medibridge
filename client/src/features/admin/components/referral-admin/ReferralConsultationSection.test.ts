import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ReferralConsultationSection } from "./ReferralConsultationSection";

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

function renderSection(input: {
  taskKind: "coordinate_time" | "schedule";
  orderStatus: "booking_in_progress" | "time_coordination";
  coordinationNote: string;
  consultationNote: string;
}) {
  return renderToStaticMarkup(
    React.createElement(ReferralConsultationSection, {
      lang: "zh",
      orderId: 101,
      orderStatus: input.orderStatus,
      taskKind: input.taskKind,
      consultationTimeInput: "",
      consultationTimeZone: "Asia/Shanghai",
      consultationProviderName: "",
      consultationPlatform: "",
      consultationJoinUrl: "",
      consultationInstructions: "",
      coordinationNote: input.coordinationNote,
      consultationNote: input.consultationNote,
      consultationDraftIssues: [],
      consultationDraftIsDirty: false,
      beginCoordinationPending: false,
      saveConsultationPending: false,
      onConsultationTimeInputChange: vi.fn(),
      onConsultationTimeZoneChange: vi.fn(),
      onConsultationProviderNameChange: vi.fn(),
      onConsultationPlatformChange: vi.fn(),
      onConsultationJoinUrlChange: vi.fn(),
      onConsultationInstructionsChange: vi.fn(),
      onCoordinationNoteChange: vi.fn(),
      onConsultationNoteChange: vi.fn(),
      onBeginCoordination: vi.fn(),
      onSaveConsultation: vi.fn(),
    })
  );
}

describe("ReferralConsultationSection", () => {
  it("shows only the coordination note while starting time coordination", () => {
    const markup = renderSection({
      taskKind: "coordinate_time",
      orderStatus: "booking_in_progress",
      coordinationNote: "已联系患者确认可用时段",
      consultationNote: "不应在此阶段出现的排期备注",
    });

    expect(markup).toContain("开始协调问诊时间");
    expect(markup).toContain("协调说明");
    expect(markup).toContain("已联系患者确认可用时段");
    expect(markup).not.toContain("不应在此阶段出现的排期备注");
  });

  it("shows only the independent scheduling note after coordination starts", () => {
    const markup = renderSection({
      taskKind: "schedule",
      orderStatus: "time_coordination",
      coordinationNote: "不应带入排期表单的协调说明",
      consultationNote: "院方要求提前十分钟进入",
    });

    expect(markup).toContain("排期备注（可选）");
    expect(markup).toContain("院方要求提前十分钟进入");
    expect(markup).not.toContain("不应带入排期表单的协调说明");
  });

  it("enables coordination from its own note rather than the scheduling note", () => {
    const emptyCoordination = renderSection({
      taskKind: "coordinate_time",
      orderStatus: "booking_in_progress",
      coordinationNote: "   ",
      consultationNote: "排期备注不应启用协调提交",
    });
    const readyCoordination = renderSection({
      taskKind: "coordinate_time",
      orderStatus: "booking_in_progress",
      coordinationNote: "已联系患者确认时段",
      consultationNote: "",
    });

    expect(emptyCoordination).toMatch(/<button[^>]*\sdisabled=/);
    expect(readyCoordination).not.toMatch(/<button[^>]*\sdisabled=/);
  });
});
