import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss()];

const HTML_PARSER_PACKAGE_PATHS = [
  "/node_modules/.pnpm/entities@",
  "/node_modules/.pnpm/parse5@",
  "/node_modules/.pnpm/property-information@",
];

function splitFrontendVendorChunk(moduleId: string) {
  const normalizedId = moduleId.replaceAll("\\", "/");
  if (
    HTML_PARSER_PACKAGE_PATHS.some(packagePath =>
      normalizedId.includes(packagePath)
    )
  ) {
    return "html-parser";
  }

  return undefined;
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: splitFrontendVendorChunk,
      },
    },
  },
  server: {
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
