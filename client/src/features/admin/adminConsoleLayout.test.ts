import { describe, expect, it } from "vitest";
import {
  getAdminConsoleChromeCopy,
  getAdminConsoleFieldLabel,
  getAdminConsoleModuleTabLabel,
  getAdminConsoleSectionCopy,
  getVisibleAdminConsoleSections,
} from "@/features/admin/adminConsoleLayout";

describe("adminConsoleLayout", () => {
  it("returns localized sidebar chrome copy", () => {
    expect(getAdminConsoleChromeCopy("zh")).toEqual({
      navigationEyebrow: "后台导航",
      navigationDescription:
        "按模块切换工作区，保留更多垂直空间给实际操作内容。",
      collapseNavigation: "收起导航",
      expandNavigation: "展开导航",
    });

    expect(getAdminConsoleChromeCopy("en")).toEqual({
      navigationEyebrow: "Admin navigation",
      navigationDescription:
        "Switch between admin modules while keeping more vertical room for the workspace itself.",
      collapseNavigation: "Collapse navigation",
      expandNavigation: "Expand navigation",
    });
  });

  it("returns localized section copy and summary pills", () => {
    expect(getAdminConsoleSectionCopy("appointments", "zh")).toEqual({
      navLabel: "预约工作台",
      navDescription: "筛选、批量操作与详情处理",
      title: "处理预约筛选、批量操作与单条详情",
      description:
        "在同一工作区内查看预约列表、筛选条件与操作详情，不改变原有处理流程。",
      summary: ["筛选视图", "批量操作", "详情面板"],
    });
  });

  it("returns localized compact filter labels", () => {
    expect(getAdminConsoleFieldLabel("riskFlagged", "en")).toBe("Flagged only");
    expect(getAdminConsoleFieldLabel("operator", "zh")).toBe("操作人");
    expect(getAdminConsoleModuleTabLabel("operationRetention", "zh")).toBe(
      "数据保留"
    );
  });

  it("keeps module visibility inside the existing role boundary", () => {
    expect(getVisibleAdminConsoleSections("admin")).toEqual([
      "overview",
      "appointments",
      "referrals",
      "directory",
      "users",
      "operations",
    ]);
    expect(getVisibleAdminConsoleSections("ops")).toEqual([
      "overview",
      "appointments",
      "referrals",
      "directory",
      "operations",
    ]);
    expect(getVisibleAdminConsoleSections("free")).toEqual([]);
  });
});
