import { describe, expect, it } from "vitest";
import {
  getAppointmentSelectionScopeKey,
  parseOptionalNonNegativeInteger,
  translateAdminConsoleError,
} from "@/features/admin/hooks/adminConsoleHelpers";

describe("parseOptionalNonNegativeInteger", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(parseOptionalNonNegativeInteger("")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("   ")).toBeUndefined();
  });

  it("parses valid non-negative integers", () => {
    expect(parseOptionalNonNegativeInteger("0")).toBe(0);
    expect(parseOptionalNonNegativeInteger(" 42 ")).toBe(42);
  });

  it("returns undefined for invalid values", () => {
    expect(parseOptionalNonNegativeInteger("-1")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("1.5")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("abc")).toBeUndefined();
  });
});

describe("getAppointmentSelectionScopeKey", () => {
  const baseScope = {
    amountMaxInput: "",
    amountMinInput: "",
    createdAtFrom: "",
    createdAtTo: "",
    doctorIdInput: "",
    emailQuery: "",
    hasRiskFilter: false,
    page: 1,
    pageSize: 50,
    paymentStatusFilter: "",
    scheduledAtFrom: "",
    scheduledAtTo: "",
    sortBy: "createdAt",
    sortDirection: "desc",
    statusFilter: "",
  };

  it("changes whenever pagination, sorting, or filters change", () => {
    const initial = getAppointmentSelectionScopeKey(baseScope);
    expect(getAppointmentSelectionScopeKey({ ...baseScope, page: 2 })).not.toBe(
      initial
    );
    expect(
      getAppointmentSelectionScopeKey({ ...baseScope, pageSize: 20 })
    ).not.toBe(initial);
    expect(
      getAppointmentSelectionScopeKey({
        ...baseScope,
        statusFilter: "paid",
      })
    ).not.toBe(initial);
    expect(
      getAppointmentSelectionScopeKey({ ...baseScope, sortBy: "amount" })
    ).not.toBe(initial);
  });
});

describe("translateAdminConsoleError", () => {
  const tr = (zh: string, _en: string) => zh;

  it("maps known storage and schema errors without exposing raw details", () => {
    expect(
      translateAdminConsoleError("RETENTION_STORAGE_UNAVAILABLE", tr)
    ).toBe("数据保留策略表不可用。请先执行数据库迁移（含 0020）。");
    expect(
      translateAdminConsoleError("Unknown column 'imageUrl' in field list", tr)
    ).toBe("医院封面字段不可用。请执行最新数据库迁移（含 0023）并重启服务。");
    expect(translateAdminConsoleError("Failed query: select", tr)).toBe(
      "数据库结构与当前代码不一致。请执行最新数据库迁移并重启服务。"
    );
  });

  it("uses the generic fallback only for empty errors", () => {
    expect(translateAdminConsoleError("  ", tr)).toBe("操作失败，请重试。");
    expect(translateAdminConsoleError("upstream unavailable", tr)).toBe(
      "upstream unavailable"
    );
  });
});
