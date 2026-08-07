import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const SKIPPED_DIRECTORIES = new Set([
  ".artifacts",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);

function normalizePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function isTestFile(filePath) {
  return /\.(?:spec|test)\.[^.]+$/.test(filePath);
}

function collectFiles(directory, projectRoot) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, projectRoot));
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push({
      path: normalizePath(path.relative(projectRoot, absolutePath)),
      source: fs.readFileSync(absolutePath, "utf8"),
    });
  }
  return files;
}

export function collectWorkspaceFiles(projectRoot) {
  return ["client/src", "server", "shared", "scripts"].flatMap(directory =>
    collectFiles(path.join(projectRoot, directory), projectRoot)
  );
}

function extractImports(source) {
  const imports = [];
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s*)?["']([^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImport(sourcePath, specifier) {
  if (specifier.startsWith("@/")) {
    return `client/src/${specifier.slice(2)}`;
  }
  if (specifier.startsWith("@shared/")) {
    return `shared/${specifier.slice("@shared/".length)}`;
  }
  if (!specifier.startsWith(".")) {
    return null;
  }
  return normalizePath(
    path.posix.normalize(
      path.posix.join(path.posix.dirname(sourcePath), specifier)
    )
  );
}

function segmentAfterPrefix(filePath, prefix) {
  if (!filePath.startsWith(prefix)) {
    return null;
  }
  return filePath.slice(prefix.length).split("/")[0] ?? null;
}

function addViolation(violations, kind, sourcePath, specifier) {
  violations.add(`${kind}:${sourcePath}->${specifier}`);
}

function analyzeFrontendImport({
  sourcePath,
  specifier,
  resolvedPath,
  violations,
}) {
  const sourceFeature = segmentAfterPrefix(sourcePath, "client/src/features/");
  const targetFeature = resolvedPath
    ? segmentAfterPrefix(resolvedPath, "client/src/features/")
    : null;

  if (sourceFeature) {
    if (resolvedPath?.startsWith("client/src/pages/")) {
      addViolation(violations, "feature-imports-page", sourcePath, specifier);
    }
    if (
      targetFeature &&
      targetFeature !== sourceFeature &&
      specifier !== `@/features/${targetFeature}`
    ) {
      addViolation(
        violations,
        "feature-cross-deep-import",
        sourcePath,
        specifier
      );
    }
  }

  if (sourcePath.startsWith("client/src/pages/") && targetFeature) {
    if (specifier !== `@/features/${targetFeature}`) {
      addViolation(
        violations,
        "page-feature-deep-import",
        sourcePath,
        specifier
      );
    }
  }

  if (sourcePath.startsWith("client/src/components/ui/") && resolvedPath) {
    const isAllowedUiDependency =
      resolvedPath.startsWith("client/src/components/ui/") ||
      resolvedPath.startsWith("client/src/lib/");
    if (!isAllowedUiDependency) {
      addViolation(violations, "ui-boundary-import", sourcePath, specifier);
    }
  }
}

function routerNameFromPath(sourcePath) {
  return path.posix.basename(sourcePath, path.posix.extname(sourcePath));
}

function analyzeRouterImport({
  sourcePath,
  specifier,
  resolvedPath,
  violations,
}) {
  if (!sourcePath.startsWith("server/routers/") || !resolvedPath) {
    return;
  }

  if (sourcePath === "server/routers/index.ts") {
    const isCompositionDependency =
      resolvedPath.startsWith("server/routers/") ||
      resolvedPath === "server/_core/trpc" ||
      resolvedPath.startsWith("shared/");
    if (!isCompositionDependency) {
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
  const ownedModule = routerName === "system" ? "admin" : routerName;
  const targetModule = segmentAfterPrefix(resolvedPath, "server/modules/");
  const isCoreTrpc = resolvedPath === "server/_core/trpc";
  const isShared = resolvedPath.startsWith("shared/");
  const isWorkflow = resolvedPath.startsWith("server/workflows/");
  const isOwnRouterApi =
    targetModule === ownedModule &&
    resolvedPath === `server/modules/${targetModule}/routerApi`;

  if (!isCoreTrpc && !isShared && !isOwnRouterApi && !isWorkflow) {
    addViolation(violations, "router-boundary-import", sourcePath, specifier);
  }
}

function analyzeModuleImport({
  sourcePath,
  specifier,
  resolvedPath,
  violations,
}) {
  const sourceModule = segmentAfterPrefix(sourcePath, "server/modules/");
  if (!sourceModule || !resolvedPath || isTestFile(sourcePath)) {
    return;
  }

  const targetModule = segmentAfterPrefix(resolvedPath, "server/modules/");
  if (
    targetModule &&
    targetModule !== sourceModule &&
    resolvedPath !== `server/modules/${targetModule}/publicApi`
  ) {
    addViolation(violations, "module-cross-deep-import", sourcePath, specifier);
  }

  if (resolvedPath.startsWith("server/routers/")) {
    addViolation(violations, "module-imports-router", sourcePath, specifier);
  }
}

function analyzeCoreImport({
  sourcePath,
  specifier,
  resolvedPath,
  violations,
}) {
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

function analyzeWorkflowImport({
  sourcePath,
  specifier,
  resolvedPath,
  violations,
}) {
  if (!sourcePath.startsWith("server/workflows/") || !resolvedPath) {
    return;
  }

  const targetModule = segmentAfterPrefix(resolvedPath, "server/modules/");
  if (
    targetModule &&
    resolvedPath !== `server/modules/${targetModule}/publicApi`
  ) {
    addViolation(violations, "workflow-deep-import", sourcePath, specifier);
  }
}

function buildModuleGraph(files) {
  const graph = new Map();
  for (const file of files) {
    const sourceModule = segmentAfterPrefix(file.path, "server/modules/");
    if (!sourceModule || isTestFile(file.path)) {
      continue;
    }

    const targets = graph.get(sourceModule) ?? new Set();
    graph.set(sourceModule, targets);
    for (const specifier of extractImports(file.source)) {
      const resolvedPath = resolveImport(file.path, specifier);
      const targetModule = resolvedPath
        ? segmentAfterPrefix(resolvedPath, "server/modules/")
        : null;
      if (targetModule && targetModule !== sourceModule) {
        targets.add(targetModule);
      }
    }
  }
  return graph;
}

function findStronglyConnectedComponents(graph) {
  let index = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];

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

    if (lowLinks.get(node) !== indexes.get(node)) {
      return;
    }

    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) {
      visit(node);
    }
  }
  return components;
}

function analyzeModuleCycles(files, violations) {
  const graph = buildModuleGraph(files);
  for (const component of findStronglyConnectedComponents(graph)) {
    if (component.length > 1) {
      violations.add(`module-cycle:${component.sort().join(",")}`);
    }
  }
}

export function analyzeArchitecture(files) {
  const violations = new Set();

  for (const file of files) {
    for (const specifier of extractImports(file.source)) {
      const resolvedPath = resolveImport(file.path, specifier);
      const context = {
        sourcePath: file.path,
        specifier,
        resolvedPath,
        violations,
      };
      analyzeFrontendImport(context);
      analyzeRouterImport(context);
      analyzeModuleImport(context);
      analyzeCoreImport(context);
      analyzeWorkflowImport(context);
    }
  }

  analyzeModuleCycles(files, violations);
  return [...violations].sort();
}

export function collectFileBudgetViolations(files, fileBudgets) {
  const violations = [];
  for (const file of files) {
    const lineCount = file.source.split("\n").length;
    const budget = fileBudgets[file.path]?.maxLines ?? 400;
    if (lineCount > budget) {
      violations.push(`file-budget:${file.path}:${lineCount}>${budget}`);
    }
  }
  return violations.sort();
}

export function checkArchitecture({ files, allowlist }) {
  const currentViolations = analyzeArchitecture(files);
  const allowedViolations = new Set(
    Object.keys(allowlist.dependencyViolations ?? {})
  );
  const unexpected = currentViolations.filter(
    violation => !allowedViolations.has(violation)
  );
  const stale = [...allowedViolations].filter(
    violation => !currentViolations.includes(violation)
  );
  const fileBudgetViolations = collectFileBudgetViolations(
    files,
    allowlist.fileBudgets ?? {}
  );

  return { fileBudgetViolations, stale, unexpected };
}
