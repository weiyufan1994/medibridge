import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

vi.stubGlobal("React", React);

afterAll(() => {
  vi.unstubAllGlobals();
});

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/components/layout/TopHeader", () => ({
  default: () => null,
}));

vi.mock("@/components/disclaimer/DisclaimerDialog", () => ({
  DisclaimerDialog: () => null,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ resolved: "zh" }),
}));

describe("Home", () => {
  it("renders one triage call to action without a duplicate referral action", () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const buttons = markup.match(/<button\b/g) ?? [];

    expect(buttons).toHaveLength(1);
    expect(markup).toContain("开始 AI 分诊");
    expect(markup).not.toContain("开始医院转诊");
  });
});
