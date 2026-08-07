import { describe, expect, it } from "vitest";
import { analyzeArchitecture } from "../scripts/architecture-guard.mjs";

function file(path: string, source: string) {
  return { path, source };
}

describe("architecture guard", () => {
  it("allows frontend consumers to use a feature root public API", () => {
    const violations = analyzeArchitecture([
      file(
        "client/src/features/admin/AdminConsole.tsx",
        'import { useAuth } from "@/features/auth";'
      ),
      file("client/src/features/auth/index.ts", "export {};"),
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects deep imports across features and from pages", () => {
    const violations = analyzeArchitecture([
      file(
        "client/src/features/admin/AdminConsole.tsx",
        'import { useAuth } from "@/features/auth/hooks/useAuth";'
      ),
      file(
        "client/src/pages/Admin.tsx",
        'import { AdminConsole } from "@/features/admin/AdminConsole";'
      ),
    ]);

    expect(violations).toEqual([
      "feature-cross-deep-import:client/src/features/admin/AdminConsole.tsx->@/features/auth/hooks/useAuth",
      "page-feature-deep-import:client/src/pages/Admin.tsx->@/features/admin/AdminConsole",
    ]);
  });

  it("allows a router to use its module routerApi and rejects internal imports", () => {
    const allowed = analyzeArchitecture([
      file(
        "server/routers/appointments.ts",
        [
          'import { appointmentActions } from "../modules/appointments/routerApi";',
          'import { checkout } from "../workflows/appointmentCheckout";',
        ].join("\n")
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/routers/appointments.ts",
        'import * as repo from "../modules/appointments/repo";'
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "router-boundary-import:server/routers/appointments.ts->../modules/appointments/repo",
    ]);
  });

  it("allows module public APIs and rejects cross-module internals", () => {
    const allowed = analyzeArchitecture([
      file(
        "server/modules/visit/actions.ts",
        'import { appointments } from "../appointments/publicApi";'
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/modules/visit/actions.ts",
        'import * as repo from "../appointments/repo";'
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "module-cross-deep-import:server/modules/visit/actions.ts->../appointments/repo",
    ]);
  });

  it("rejects business imports from core and deep imports from workflows", () => {
    const violations = analyzeArchitecture([
      file(
        "server/_core/context.ts",
        'import * as auth from "../modules/auth/publicApi";'
      ),
      file(
        "server/workflows/booking.ts",
        'import * as payments from "../modules/payments/actions";'
      ),
    ]);

    expect(violations).toEqual([
      "core-business-import:server/_core/context.ts->../modules/auth/publicApi",
      "workflow-deep-import:server/workflows/booking.ts->../modules/payments/actions",
    ]);
  });

  it("rejects cyclic server module dependencies", () => {
    const violations = analyzeArchitecture([
      file(
        "server/modules/appointments/actions.ts",
        'import { payments } from "../payments/publicApi";'
      ),
      file(
        "server/modules/payments/actions.ts",
        'import { appointments } from "../appointments/publicApi";'
      ),
    ]);

    expect(violations).toEqual(["module-cycle:appointments,payments"]);
  });
});
