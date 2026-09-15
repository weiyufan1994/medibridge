import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import Home from "@/pages/Home";

vi.stubGlobal("React", React);

const language = vi.hoisted(() => ({ resolved: "zh" as "zh" | "en" }));

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
  useLanguage: () => language,
}));

describe("Home", () => {
  it.each(["zh", "en"] as const)(
    "renders one triage call to action without the removed description in %s",
    locale => {
      language.resolved = locale;
      const markup = renderToStaticMarkup(createElement(Home));
      const buttons = markup.match(/<button\b/g) ?? [];

      expect(buttons).toHaveLength(1);
      expect(markup).toContain(
        locale === "zh" ? "开始 AI 分诊" : "Start AI Triage"
      );
      expect(markup).not.toContain(
        locale === "zh" ? "开始医院转诊" : "Start Hospital Referral"
      );
      expect(markup).not.toContain(
        locale === "zh"
          ? "MediBridge 通过 AI 分诊给出医院排序"
          : "MediBridge uses AI triage to rank suitable hospitals"
      );
    }
  );
});
