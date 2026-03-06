import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createConnection } from "mysql2/promise";

type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

async function repairMigrationHistory() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const journalPath = path.resolve("drizzle/meta/_journal.json");
  const journalRaw = fs.readFileSync(journalPath, "utf8");
  const journal = JSON.parse(journalRaw) as { entries?: JournalEntry[] };
  const entries = journal.entries ?? [];
  if (entries.length === 0) {
    throw new Error("drizzle/meta/_journal.json has no entries");
  }

  const connection = await createConnection(databaseUrl);
  try {
    const [existingRows] = await connection.query(
      "select id from __drizzle_migrations order by id"
    );
    const existingIds = new Set(
      (existingRows as Array<{ id: number }>).map(row => Number(row.id))
    );

    const missing = entries
      .map(entry => ({
        id: entry.idx + 1,
        tag: entry.tag,
        when: entry.when,
      }))
      .filter(entry => !existingIds.has(entry.id));

    if (missing.length === 0) {
      console.log("No missing migration history rows. Nothing to repair.");
      return;
    }

    for (const row of missing) {
      await connection.query(
        "insert into __drizzle_migrations (id, hash, created_at) values (?, ?, ?)",
        [row.id, `manual-baseline-${row.tag}`, row.when]
      );
    }

    console.log(
      `Repaired migration history. Inserted ids: ${missing
        .map(row => row.id)
        .join(", ")}`
    );
  } finally {
    await connection.end();
  }
}

repairMigrationHistory().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to repair migration history: ${message}`);
  process.exit(1);
});

