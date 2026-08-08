import { describe, expect, it } from "vitest";
import {
  analyzeArchitecture,
  checkArchitecture,
} from "../scripts/architecture-guard.mjs";
import {
  compareAllowlists,
  validateAllowlist,
} from "../scripts/architecture-policy.mjs";

function file(path: string, source: string) {
  return { path, source };
}

describe("architecture dependency rules", () => {
  it("allows feature consumers to use the root public API", () => {
    expect(
      analyzeArchitecture([
        file(
          "client/src/features/admin/AdminConsole.tsx",
          'import { useAuth } from "@/features/auth";'
        ),
        file("client/src/features/auth/index.ts", "export {};"),
      ])
    ).toEqual([]);
  });

  it("rejects feature internals imported across frontend boundaries", () => {
    expect(
      analyzeArchitecture([
        file(
          "client/src/features/admin/AdminConsole.tsx",
          'import { useAuth } from "@/features/auth/hooks/useAuth";'
        ),
        file(
          "client/src/pages/Admin.tsx",
          'import Admin from "@/features/admin/AdminConsole";'
        ),
        file(
          "client/src/App.tsx",
          'const Login = import("@/features/auth/components/LoginModal");'
        ),
      ])
    ).toEqual([
      "frontend-feature-deep-import:client/src/App.tsx->@/features/auth/components/LoginModal",
      "frontend-feature-deep-import:client/src/features/admin/AdminConsole.tsx->@/features/auth/hooks/useAuth",
      "frontend-feature-deep-import:client/src/pages/Admin.tsx->@/features/admin/AdminConsole",
    ]);
  });

  it("rejects feature imports from shared UI primitives", () => {
    const allowed = analyzeArchitecture([
      file(
        "client/src/components/ui/button.tsx",
        'import { cn } from "@/lib/utils";'
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "client/src/components/ui/button.tsx",
        'import { useAuth } from "@/features/auth";'
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "ui-boundary-import:client/src/components/ui/button.tsx->@/features/auth",
    ]);
  });

  it("allows router boundaries and rejects internal or foreign module imports", () => {
    const allowed = analyzeArchitecture([
      file(
        "server/routers/appointments.ts",
        [
          'import { router } from "../_core/trpc";',
          'import { api } from "../modules/appointments/routerApi";',
          'import { checkout } from "../workflows/appointmentCheckout";',
        ].join("\n")
      ),
      file(
        "server/routers/consultation.ts",
        'import { api } from "../modules/ai/routerApi";'
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/routers/appointments.ts",
        [
          'import * as repo from "../modules/appointments/repo";',
          'import { payment } from "../modules/payments/routerApi";',
          'import { url } from "../_core/getPublicBaseUrl";',
        ].join("\n")
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "router-boundary-import:server/routers/appointments.ts->../_core/getPublicBaseUrl",
      "router-boundary-import:server/routers/appointments.ts->../modules/appointments/repo",
      "router-boundary-import:server/routers/appointments.ts->../modules/payments/routerApi",
    ]);
  });

  it("keeps router composition limited to routers and trpc", () => {
    const allowed = analyzeArchitecture([
      file(
        "server/routers/index.ts",
        [
          'import { router } from "../_core/trpc";',
          'import { authRouter } from "./auth";',
        ].join("\n")
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/routers/index.ts",
        'import { systemRouter } from "../_core/systemRouter";'
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "router-composition-import:server/routers/index.ts->../_core/systemRouter",
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
        "server/modules/visit/actions.test.ts",
        [
          'import * as repo from "../appointments/repo";',
          'import { router } from "../../routers/appointments";',
        ].join("\n")
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "module-cross-deep-import:server/modules/visit/actions.test.ts->../appointments/repo",
      "module-imports-router:server/modules/visit/actions.test.ts->../../routers/appointments",
    ]);
  });

  it("keeps business imports out of core except for the composition root", () => {
    const allowed = analyzeArchitecture([
      file("server/_core/index.ts", 'import { appRouter } from "../routers";'),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/_core/context.ts",
        'import * as auth from "../modules/auth/publicApi";'
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "core-business-import:server/_core/context.ts->../modules/auth/publicApi",
    ]);
  });

  it("allows workflows to use module public APIs only", () => {
    const allowed = analyzeArchitecture([
      file(
        "server/workflows/booking.ts",
        'import { payments } from "../modules/payments/publicApi";'
      ),
    ]);
    const rejected = analyzeArchitecture([
      file(
        "server/workflows/booking.ts",
        [
          'import * as paymentRepo from "../modules/payments/repo";',
          'import { router } from "../routers/payments";',
          'import { getDb } from "../db";',
        ].join("\n")
      ),
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual([
      "workflow-deep-import:server/workflows/booking.ts->../modules/payments/repo",
      "workflow-imports-router:server/workflows/booking.ts->../routers/payments",
      "workflow-persistence-import:server/workflows/booking.ts->../db",
    ]);
  });

  it("rejects cyclic module and feature dependencies", () => {
    expect(
      analyzeArchitecture([
        file(
          "server/modules/appointments/actions.ts",
          'import { payments } from "../payments/publicApi";'
        ),
        file(
          "server/modules/payments/actions.ts",
          'import { appointments } from "../appointments/publicApi";'
        ),
        file(
          "client/src/features/admin/index.ts",
          'import { auth } from "@/features/auth";'
        ),
        file(
          "client/src/features/auth/index.ts",
          'import { admin } from "@/features/admin";'
        ),
      ])
    ).toEqual([
      "feature-cycle:admin,auth",
      "module-cycle:appointments,payments",
    ]);
  });
});

describe("architecture allowlist and file budgets", () => {
  const reason =
    "Existing dependency to remove in the assigned hardening phase";

  it("requires exact entries with a remediation phase and reason", () => {
    expect(
      validateAllowlist({
        dependencyViolations: {
          "module-*:server/modules/a/actions.ts->../b/repo": {
            phase: "7",
            reason: "",
          },
        },
        fileBudgets: {
          "client/src/features/*": { maxLines: 400, phase: "5", reason: "" },
        },
      })
    ).toEqual([
      "allowlist-invalid-phase:module-*:server/modules/a/actions.ts->../b/repo",
      "allowlist-missing-reason:module-*:server/modules/a/actions.ts->../b/repo",
      "allowlist-wildcard:module-*:server/modules/a/actions.ts->../b/repo",
      "file-budget-invalid-limit:client/src/features/*",
      "file-budget-missing-reason:client/src/features/*",
      "file-budget-wildcard:client/src/features/*",
    ]);
  });

  it("allows only removal or line-budget reduction from an established baseline", () => {
    const base = {
      dependencyViolations: {
        "module-cross-deep-import:a->b": { phase: "4", reason },
      },
      fileBudgets: {
        "server/large.ts": { maxLines: 800, phase: "4", reason },
      },
    };

    expect(
      compareAllowlists(base, {
        dependencyViolations: {},
        fileBudgets: {
          "server/large.ts": { maxLines: 700, phase: "4", reason },
        },
      })
    ).toEqual([]);
    expect(
      compareAllowlists(base, {
        dependencyViolations: {
          ...base.dependencyViolations,
          "module-cross-deep-import:c->d": { phase: "4", reason },
        },
        fileBudgets: {
          "server/large.ts": { maxLines: 900, phase: "5", reason },
          "server/new-large.ts": { maxLines: 500, phase: "4", reason },
        },
      })
    ).toEqual([
      "allowlist-added:module-cross-deep-import:c->d",
      "file-budget-added:server/new-large.ts",
      "file-budget-increased:server/large.ts",
      "file-budget-metadata-changed:server/large.ts",
    ]);
  });

  it("blocks new oversized files, growth, and stale budget entries", () => {
    const source = Array.from({ length: 450 }, () => "line").join("\n");
    const result = checkArchitecture({
      files: [file("server/new-large.ts", source)],
      allowlist: {
        dependencyViolations: {},
        fileBudgets: {
          "server/removed.ts": { maxLines: 500, phase: "4", reason },
        },
      },
    });

    expect(result.fileBudgetViolations).toEqual([
      "file-budget:server/new-large.ts:450>400",
    ]);
    expect(result.staleFileBudgets).toEqual([
      "stale-file-budget:server/removed.ts",
    ]);
  });
});
