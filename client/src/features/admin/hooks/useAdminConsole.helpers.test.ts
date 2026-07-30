import { describe, expect, it } from "vitest";
import {
  getAppointmentSelectionScopeKey,
  parseOptionalNonNegativeInteger,
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
