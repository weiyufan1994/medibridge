import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const CLIENT_SRC_DIR = path.join(ROOT_DIR, "client", "src");
const EXCLUDED_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".copy.ts"];
const EXCLUDED_BASENAMES = new Set(["copy.ts"]);
const INLINE_I18N_PATTERN =
  /resolved === "zh"|lang === "zh"|resolved === "en"|lang === "en"/g;

type FileMatch = {
  path: string;
  count: number;
};

function shouldSkipFile(filePath: string) {
  const basename = path.basename(filePath);
  if (EXCLUDED_BASENAMES.has(basename)) {
    return true;
  }

  return EXCLUDED_FILE_SUFFIXES.some(suffix => filePath.endsWith(suffix));
}

function walkFiles(dirPath: string, results: string[]) {
  for (const entry of readdirSync(dirPath)) {
    const absolutePath = path.join(dirPath, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkFiles(absolutePath, results);
      continue;
    }

    if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
      continue;
    }

    if (shouldSkipFile(absolutePath)) {
      continue;
    }

    results.push(absolutePath);
  }
}

function collectInlineI18nMatches() {
  const files: string[] = [];
  walkFiles(CLIENT_SRC_DIR, files);

  const matches: FileMatch[] = [];
  let totalMatches = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf8");
    const count = [...content.matchAll(INLINE_I18N_PATTERN)].length;
    if (count === 0) {
      continue;
    }

    totalMatches += count;
    matches.push({
      path: path.relative(ROOT_DIR, filePath),
      count,
    });
  }

  matches.sort((left, right) => right.count - left.count || left.path.localeCompare(right.path));

  return {
    totalFiles: files.length,
    totalMatches,
    matches,
  };
}

const result = collectInlineI18nMatches();

console.log(`Scanned ${result.totalFiles} client files.`);
console.log(`Found ${result.totalMatches} inline i18n branch matches outside copy.ts files.`);

if (result.matches.length > 0) {
  console.log("\nTop files:");
  for (const item of result.matches.slice(0, 20)) {
    console.log(`- ${item.path}: ${item.count}`);
  }
}
