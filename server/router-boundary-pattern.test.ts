import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as appointmentRouterApi from "./modules/appointments/routerApi";
import * as paymentRouterApi from "./modules/payments/routerApi";
import * as visitRouterApi from "./modules/visit/routerApi";
import * as authRouterApi from "./modules/auth/routerApi";
import * as chatRouterApi from "./modules/chat/routerApi";
import * as aiRouterApi from "./modules/ai/routerApi";
import * as doctorRouterApi from "./modules/doctors/routerApi";
import * as hospitalRouterApi from "./modules/hospitals/routerApi";
import * as referralRouterApi from "./modules/referrals/routerApi";

function readRouterFile(fileName: string): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), "server", "routers", fileName),
    "utf8"
  );
}

function listRouterFiles(): string[] {
  const routersDir = path.resolve(process.cwd(), "server", "routers");
  return fs
    .readdirSync(routersDir)
    .filter(fileName => fileName.endsWith(".ts") && fileName !== "index.ts")
    .sort();
}

function getRouterLineCount(fileName: string): number {
  const source = readRouterFile(fileName);
  return source.split("\n").length;
}

describe("router boundary pattern", () => {
  it("routerApi modules expose grouped exports only", () => {
    expect(Object.keys(appointmentRouterApi).sort()).toEqual([
      "appointmentActions",
      "appointmentCore",
      "appointmentSchemas",
    ]);
    expect(Object.keys(paymentRouterApi).sort()).toEqual([
      "paymentActions",
      "paymentSchemas",
    ]);
    expect(Object.keys(visitRouterApi).sort()).toEqual([
      "visitActions",
      "visitSchemas",
    ]);
    expect(Object.keys(authRouterApi).sort()).toEqual([
      "authActions",
      "authSchemas",
    ]);
    expect(Object.keys(chatRouterApi).sort()).toEqual([
      "chatActions",
      "chatSchemas",
    ]);
    expect(Object.keys(aiRouterApi).sort()).toEqual(["aiActions", "aiSchemas"]);
    expect(Object.keys(doctorRouterApi).sort()).toEqual([
      "doctorActions",
      "doctorSchemas",
    ]);
    expect(Object.keys(hospitalRouterApi).sort()).toEqual([
      "hospitalActions",
      "hospitalSchemas",
    ]);
    expect(Object.keys(referralRouterApi).sort()).toEqual([
      "referralActions",
      "referralSchemas",
    ]);
  });

  it("appointments router does not bypass module routerApi boundary", () => {
    const source = readRouterFile("appointments.ts");

    expect(source).toContain('from "../modules/appointments/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/appointments\/(?!routerApi\b)[^"']+["']/
    );
    expect(source).not.toMatch(/from\s+["']\.\.\/routers\//);
  });

  it("payments router does not bypass module routerApi boundary", () => {
    const source = readRouterFile("payments.ts");

    expect(source).toContain('from "../modules/payments/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/payments\/(?!routerApi\b)[^"']+["']/
    );
    expect(source).not.toMatch(/from\s+["']\.\.\/routers\//);
  });

  it("visit/chat/auth routers avoid router-to-router imports", () => {
    for (const fileName of ["visit.ts", "chat.ts", "auth.ts"] as const) {
      const source = readRouterFile(fileName);
      expect(source).not.toMatch(/from\s+["']\.\.\/routers\//);
      expect(source).not.toMatch(/from\s+["']\.\//);
    }
  });

  it("visit router uses module routerApi boundary", () => {
    const source = readRouterFile("visit.ts");
    expect(source).toContain('from "../modules/visit/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/visit\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("auth router uses module routerApi boundary", () => {
    const source = readRouterFile("auth.ts");
    expect(source).toContain('from "../modules/auth/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/auth\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("chat router uses module routerApi boundary", () => {
    const source = readRouterFile("chat.ts");
    expect(source).toContain('from "../modules/chat/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/chat\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("ai router uses module routerApi boundary", () => {
    const source = readRouterFile("ai.ts");
    expect(source).toContain('from "../modules/ai/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/ai\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("doctors router uses module routerApi boundary", () => {
    const source = readRouterFile("doctors.ts");
    expect(source).toContain('from "../modules/doctors/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/doctors\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("hospitals router uses module routerApi boundary", () => {
    const source = readRouterFile("hospitals.ts");
    expect(source).toContain('from "../modules/hospitals/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/hospitals\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("referrals router uses module routerApi boundary", () => {
    const source = readRouterFile("referrals.ts");
    expect(source).toContain('from "../modules/referrals/routerApi"');
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/referrals\/(?!routerApi\b)[^"']+["']/
    );
  });

  it("router index composes doctors and hospitals through router entrypoints", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server", "routers", "index.ts"),
      "utf8"
    );

    expect(source).toContain('import { doctorsRouter } from "./doctors";');
    expect(source).toContain('import { hospitalsRouter } from "./hospitals";');
    expect(source).toContain('import { referralsRouter } from "./referrals";');
    expect(source).toContain("doctors: doctorsRouter");
    expect(source).toContain("hospitals: hospitalsRouter");
    expect(source).toContain("referrals: referralsRouter");
    expect(source).not.toMatch(
      /from\s+["']\.\.\/modules\/(doctors|hospitals|referrals)\//
    );
  });

  it("all non-index routers avoid router-to-router imports", () => {
    for (const fileName of listRouterFiles()) {
      const source = readRouterFile(fileName);
      expect(source).not.toMatch(/from\s+["']\.\.\/routers\//);
      expect(source).not.toMatch(/from\s+["']\.\//);
    }
  });

  it("large routers should stay focused and bounded", () => {
    const lines = {
      appointments: getRouterLineCount("appointments.ts"),
      chat: getRouterLineCount("chat.ts"),
      doctors: getRouterLineCount("doctors.ts"),
      hospitals: getRouterLineCount("hospitals.ts"),
      referrals: getRouterLineCount("referrals.ts"),
    };

    // Budget reflects the thin router's canonical Prettier layout.
    expect(lines.appointments).toBeLessThanOrEqual(260);
    expect(lines.chat).toBeLessThanOrEqual(80);
    expect(lines.doctors).toBeLessThanOrEqual(60);
    expect(lines.hospitals).toBeLessThanOrEqual(30);
    expect(lines.referrals).toBeLessThanOrEqual(260);
  });
});
