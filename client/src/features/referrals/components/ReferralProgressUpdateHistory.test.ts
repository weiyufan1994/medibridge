import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReferralProgressUpdateHistory } from "./ReferralProgressUpdateHistory";

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

describe("ReferralProgressUpdateHistory", () => {
  it("renders an earlier patient-visible update below the latest update", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReferralProgressUpdateHistory, {
        lang: "zh",
        latestUpdate: {
          text: "问诊时间已确认",
          updatedAt: "2026-04-12T08:30:00.000Z",
        },
        previousUpdates: [
          {
            id: 11,
            text: "已提交资料，正在等待院方确认",
            updatedAt: "2026-04-12T08:00:00.000Z",
          },
        ],
      })
    );

    expect(html).toContain("问诊时间已确认");
    expect(html).toContain("以往进展");
    expect(html).toContain("已提交资料，正在等待院方确认");
  });
});
