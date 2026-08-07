import fs from "node:fs";
import path from "node:path";

const outputRoot = path.resolve("dist/public");
const forbiddenValues = [
  ["VITE", "FRONTEND", "FORGE", "API", "KEY"].join("_"),
  "FORGE_MAPS_PROXY_API_KEY",
];

for (const envFile of [".env.development", ".env.production"]) {
  if (!fs.existsSync(envFile)) continue;
  const content = fs.readFileSync(envFile, "utf8");
  const match = content.match(/^FORGE_MAPS_PROXY_API_KEY=(.*)$/m);
  const value = stripOptionalQuotes(match?.[1]?.trim() ?? "");
  if (value.length >= 8) forbiddenValues.push(value);
}

if (!fs.existsSync(outputRoot)) {
  console.error("Client bundle secret scan failed: dist/public is missing.");
  process.exit(1);
}

const matches = [];
for (const file of walkFiles(outputRoot)) {
  const content = fs.readFileSync(file);
  for (const forbidden of forbiddenValues) {
    if (forbidden && content.includes(Buffer.from(forbidden))) {
      matches.push(path.relative(process.cwd(), file));
      break;
    }
  }
}

if (matches.length > 0) {
  console.error(
    `Client bundle secret scan failed in ${matches.length} file(s):\n${matches.join("\n")}`
  );
  process.exit(1);
}

console.log("Client bundle secret scan passed.");

function stripOptionalQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}
