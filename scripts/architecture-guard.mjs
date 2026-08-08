import fs from "node:fs";
import path from "node:path";
import { extractImports } from "./architecture-imports.mjs";
import { validateAllowlist } from "./architecture-policy.mjs";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const SKIPPED_DIRECTORIES = new Set([
  ".artifacts",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);
const ROUTER_MODULE_OVERRIDES = new Map([
  ["consultation", "ai"],
  ["system", "admin"],
]);

function normalizePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function stripSourceExtension(value) {
  return value.replace(/\.(?:js|mjs|ts|tsx)$/, "");
}

function isTestFile(filePath) {
  return /\.(?:spec|test)\.[^.]+$/.test(filePath);
}

function collectFiles(directory, projectRoot) {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, projectRoot));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push({
        path: normalizePath(path.relative(projectRoot, absolutePath)),
        source: fs.readFileSync(absolutePath, "utf8"),
      });
    }
  }
  return files;
}

export function collectWorkspaceFiles(projectRoot) {
  return ["client/src", "server", "shared", "scripts"].flatMap(directory =>
    collectFiles(path.join(projectRoot, directory), projectRoot)
  );
}

function resolveImport(sourcePath, specifier) {
  if (specifier.startsWith("@/")) {
    return `client/src/${specifier.slice(2)}`;
  }
  if (specifier === "@shared") return "shared";
  if (specifier.startsWith("@shared/")) {
    return `shared/${specifier.slice("@shared/".length)}`;
  }
  if (!specifier.startsWith(".")) return null;
  return normalizePath(
    path.posix.normalize(
      path.posix.join(path.posix.dirname(sourcePath), specifier)
    )
  );
}

function segmentAfterPrefix(filePath, prefix) {
  if (!filePath.startsWith(prefix)) return null;
  return filePath.slice(prefix.length).split("/")[0] || null;
}

function addViolation(violations, kind, sourcePath, specifier) {
  violations.add(`${kind}:${sourcePath}->${specifier}`);
}

function analyzeFrontendImport(context) {
  const { sourcePath, specifier, resolvedPath, violations } = context;
  if (!sourcePath.startsWith("client/src/") || !resolvedPath) return;

  const sourceFeature = segmentAfterPrefix(sourcePath, "client/src/features/");
  const targetFeature = segmentAfterPrefix(
    resolvedPath,
    "client/src/features/"
  );

  if (sourceFeature && resolvedPath.startsWith("client/src/pages/")) {
    addViolation(violations, "feature-imports-page", sourcePath, specifier);
  }

  if (
    targetFeature &&
    targetFeature !== sourceFeature &&
    specifier !== `@/features/${targetFeature}`
  ) {
    addViolation(
      violations,
      "frontend-feature-deep-import",
      sourcePath,
      specifier
    );
  }

  if (sourcePath.startsWith("client/src/components/ui/")) {
    const allowed =
      resolvedPath.startsWith("client/src/components/ui/") ||
      resolvedPath.startsWith("client/src/lib/");
    if (!allowed) {
      addViolation(violations, "ui-boundary-import", sourcePath, specifier);
    }
  }
}

function routerNameFromPath(sourcePath) {
  return path.posix.basename(sourcePath, path.posix.extname(sourcePath));
}

function analyzeRouterImport(context) {
  const { sourcePath, specifier, resolvedPath, violations } = context;
  if (!sourcePath.startsWith("server/routers/") || !resolvedPath) return;

  if (sourcePath === "server/routers/index.ts") {
    const allowed =
      resolvedPath.startsWith("server/routers/") ||
      stripSourceExtension(resolvedPath) === "server/_core/trpc";
    if (!allowed) {
      addViolation(
        violations,
        "router-composition-import",
        sourcePath,
        specifier
      );
    }
    return;
  }

  const routerName = routerNameFromPath(sourcePath);
  const ownedModule = ROUTER_MODULE_OVERRIDES.get(routerName) ?? routerName;
  const normalizedTarget = stripSourceExtension(resolvedPath);
  const allowed =
    normalizedTarget === "server/_core/trpc" ||
    normalizedTarget === `server/modules/${ownedModule}/routerApi` ||
    resolvedPath.startsWith("server/workflows/");

  if (!allowed) {
    addViolation(violations, "router-boundary-import", sourcePath, specifier);
  }
}

function analyzeModuleImport(context) {
  const { sourcePath, specifier, resolvedPath, violations } = context;
  const sourceModule = segmentAfterPrefix(sourcePath, "server/modules/");
  if (!sourceModule || !resolvedPath) return;

  const targetModule = segmentAfterPrefix(resolvedPath, "server/modules/");
  const normalizedTarget = stripSourceExtension(resolvedPath);
  if (
    targetModule &&
    targetModule !== sourceModule &&
    normalizedTarget !== `server/modules/${targetModule}/publicApi`
  ) {
    addViolation(violations, "module-cross-deep-import", sourcePath, specifier);
  }
  if (resolvedPath.startsWith("server/routers/")) {
    addViolation(violations, "module-imports-router", sourcePath, specifier);
  }
}

function analyzeCoreImport(context) {
  const { sourcePath, specifier, resolvedPath, violations } = context;
  if (
    !sourcePath.startsWith("server/_core/") ||
    sourcePath === "server/_core/index.ts" ||
    !resolvedPath
  ) {
    return;
  }

  if (
    resolvedPath.startsWith("server/modules/") ||
    resolvedPath.startsWith("server/routers/")
  ) {
    addViolation(violations, "core-business-import", sourcePath, specifier);
  }
}

function analyzeWorkflowImport(context) {
  const { sourcePath, specifier, resolvedPath, violations } = context;
  if (!sourcePath.startsWith("server/workflows/") || !resolvedPath) return;

  const targetModule = segmentAfterPrefix(resolvedPath, "server/modules/");
  const normalizedTarget = stripSourceExtension(resolvedPath);
  if (
    targetModule &&
    normalizedTarget !== `server/modules/${targetModule}/publicApi`
  ) {
    addViolation(violations, "workflow-deep-import", sourcePath, specifier);
  }
  if (resolvedPath.startsWith("server/routers/")) {
    addViolation(violations, "workflow-imports-router", sourcePath, specifier);
  }
  if (normalizedTarget === "server/db" || resolvedPath.startsWith("drizzle/")) {
    addViolation(
      violations,
      "workflow-persistence-import",
      sourcePath,
      specifier
    );
  }
}

function buildBoundaryGraph(files, prefix) {
  const graph = new Map();
  for (const file of files) {
    const sourceNode = segmentAfterPrefix(file.path, prefix);
    if (!sourceNode || isTestFile(file.path)) continue;

    const targets = graph.get(sourceNode) ?? new Set();
    graph.set(sourceNode, targets);
    for (const specifier of extractImports(file.source, file.path)) {
      const resolvedPath = resolveImport(file.path, specifier);
      const targetNode = resolvedPath
        ? segmentAfterPrefix(resolvedPath, prefix)
        : null;
      if (targetNode && targetNode !== sourceNode) targets.add(targetNode);
    }
  }
  return graph;
}

function findCycles(graph) {
  let index = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];

  function visit(node) {
    indexes.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node) ?? []) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(target)));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1) cycles.push(component.sort());
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) visit(node);
  }
  return cycles;
}

export function analyzeArchitecture(files) {
  const violations = new Set();
  for (const file of files) {
    for (const specifier of extractImports(file.source, file.path)) {
      const context = {
        sourcePath: file.path,
        specifier,
        resolvedPath: resolveImport(file.path, specifier),
        violations,
      };
      analyzeFrontendImport(context);
      analyzeRouterImport(context);
      analyzeModuleImport(context);
      analyzeCoreImport(context);
      analyzeWorkflowImport(context);
    }
  }

  for (const cycle of findCycles(
    buildBoundaryGraph(files, "server/modules/")
  )) {
    violations.add(`module-cycle:${cycle.join(",")}`);
  }
  for (const cycle of findCycles(
    buildBoundaryGraph(files, "client/src/features/")
  )) {
    violations.add(`feature-cycle:${cycle.join(",")}`);
  }
  return [...violations].sort();
}

export function checkArchitecture({ files, allowlist }) {
  const currentViolations = analyzeArchitecture(files);
  const allowedViolations = new Set(
    Object.keys(allowlist.dependencyViolations ?? {})
  );
  const unexpected = currentViolations.filter(
    item => !allowedViolations.has(item)
  );
  const staleDependencies = [...allowedViolations].filter(
    item => !currentViolations.includes(item)
  );
  const filesByPath = new Map(files.map(file => [file.path, file]));
  const fileBudgetViolations = [];
  const staleFileBudgets = [];

  for (const file of files) {
    const lineCount = file.source.split("\n").length;
    const maxLines = allowlist.fileBudgets?.[file.path]?.maxLines ?? 400;
    if (lineCount > maxLines) {
      fileBudgetViolations.push(
        `file-budget:${file.path}:${lineCount}>${maxLines}`
      );
    }
  }
  for (const filePath of Object.keys(allowlist.fileBudgets ?? {})) {
    const file = filesByPath.get(filePath);
    if (!file || file.source.split("\n").length <= 400) {
      staleFileBudgets.push(`stale-file-budget:${filePath}`);
    }
  }

  return {
    allowlistErrors: validateAllowlist(allowlist),
    fileBudgetViolations: fileBudgetViolations.sort(),
    staleDependencies: staleDependencies.sort(),
    staleFileBudgets: staleFileBudgets.sort(),
    unexpected,
  };
}
