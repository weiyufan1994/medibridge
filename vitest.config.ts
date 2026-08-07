import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        branches: 60,
        functions: 41,
        lines: 28,
        statements: 28,
        "server/_core/mapsProxy.ts": {
          lines: 90,
        },
      },
    },
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.spec.ts",
    ],
    pool: "forks",
  },
});
