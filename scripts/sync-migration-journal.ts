import "../server/_core/loadEnv";
import fs from "node:fs";
import path from "node:path";

type JournalEntry = {
  idx: number;
  tag: string;
  version: string;
  when: number;
  breakpoints: boolean;
};

type JournalFile = {
  entries?: JournalEntry[];
};

function listMigrationTags() {
  return fs
    .readdirSync(path.resolve("drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => path.basename(name, ".sql"))
    .sort();
}

function main() {
  const journalPath = path.resolve("drizzle/meta/_journal.json");
  const raw = fs.readFileSync(journalPath, "utf8");
  const journal = JSON.parse(raw) as JournalFile;
  const entries = journal.entries ?? [];

  const migrationTags = listMigrationTags();
  const existingTags = new Set(entries.map((entry) => entry.tag));
  const missingTags = migrationTags.filter((tag) => !existingTags.has(tag));

  if (missingTags.length === 0) {
    console.log("[journal-sync] already in sync, no action needed.");
    return;
  }

  const version = entries.length > 0 ? entries[entries.length - 1]?.version ?? "5" : "5";
  let now = Date.now();

  for (const tag of missingTags) {
    const idx = entries.length;
    entries.push({
      idx,
      tag,
      version,
      when: now++,
      breakpoints: true,
    });
  }

  const sortedEntries = entries
    .sort((a, b) => a.idx - b.idx)
    .map((entry, idx) => ({ ...entry, idx }));

  fs.writeFileSync(
    journalPath,
    `${JSON.stringify({ ...journal, entries: sortedEntries }, null, 2)}\n`
  );
  console.log(`[journal-sync] appended missing tags: ${missingTags.join(", ")}`);
}

main();
