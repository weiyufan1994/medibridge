import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createConnection } from "mysql2/promise";

type JournalEntry = {
  idx: number;
  tag: string;
};

function loadJournalEntries() {
  const journalPath = path.resolve("drizzle/meta/_journal.json");
  const raw = fs.readFileSync(journalPath, "utf8");
  const parsed = JSON.parse(raw) as { entries?: JournalEntry[] };
  return parsed.entries ?? [];
}

function listMigrationTags() {
  const entries = fs.readdirSync(path.resolve("drizzle"));
  return entries
    .filter((name) => name.endsWith(".sql"))
    .map(name => path.basename(name, ".sql"))
    .sort();
}

async function verify() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const journalEntries = loadJournalEntries();
  const expectedCount = journalEntries.length;
  const migrationTags = listMigrationTags();
  const journalTags = journalEntries.map((entry) => entry.tag).sort();
  const missingTagsInJournalForFiles = migrationTags.filter(
    tag => !journalTags.includes(tag)
  );
  const extraJournalTags = journalEntries
    .map(entry => entry.tag)
    .filter(tag => !migrationTags.includes(tag))
    .sort();
  let migrationDrift = false;
  if (missingTagsInJournalForFiles.length > 0) {
    console.log(
      `- warning: local drizzle journal missing tags on disk: ${missingTagsInJournalForFiles.join(", ")}`
    );
    migrationDrift = true;
  }
  if (extraJournalTags.length > 0) {
    console.log(
      `- warning: local drizzle journal has extra tags not in migrations folder: ${extraJournalTags.join(", ")}`
    );
    migrationDrift = true;
  }

  const requiredTags = [
    "0020_ops_admin_summary_retention",
    "0021_appointment_messages_composite_index",
  ];
  const requiredTagSet = new Set(requiredTags);
  const missingTagsInJournal = requiredTags.filter(
    tag => !journalEntries.some(entry => entry.tag === tag)
  );
  if (missingTagsInJournal.length > 0) {
    throw new Error(
      `Local drizzle journal is missing expected tags: ${missingTagsInJournal.join(", ")}`
    );
  }

  const connection = await createConnection(databaseUrl);
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, "");

  try {
    const [migrationRows] = await connection.query(
      "select count(*) as count from __drizzle_migrations"
    );
    const appliedCount = Number((migrationRows as Array<{ count: number }>)[0]?.count ?? 0);
    const migrationHistoryOutdated = appliedCount < expectedCount;

    const [tableRows] = await connection.query(
      `select table_name as tableName
       from information_schema.tables
       where table_schema = ?
         and table_name in ('appointment_visit_summaries','visit_retention_policies','retention_cleanup_audits')
       order by table_name`,
      [dbName]
    );
    const existingTables = new Set(
      (tableRows as Array<{ tableName: string }>).map(row => row.tableName)
    );
    const missingTables = [
      "appointment_visit_summaries",
      "visit_retention_policies",
      "retention_cleanup_audits",
    ].filter(name => !existingTables.has(name));
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
    }

    const [indexRows] = await connection.query(
      `select index_name as indexName
       from information_schema.statistics
       where table_schema = ?
         and table_name = 'appointmentMessages'
         and index_name = 'appointmentMessagesAppointmentCreatedAtIdx'`,
      [dbName]
    );
    if ((indexRows as Array<{ indexName: string }>).length === 0) {
      throw new Error("Missing required index: appointmentMessagesAppointmentCreatedAtIdx");
    }

    const [retentionRows] = await connection.query(
      "select count(*) as count from visit_retention_policies"
    );
    const retentionCount = Number(
      (retentionRows as Array<{ count: number }>)[0]?.count ?? 0
    );
    if (retentionCount === 0) {
      throw new Error("visit_retention_policies is empty (default rows not initialized)");
    }

    console.log("Migration verification passed.");
    console.log(`- applied migrations history: ${appliedCount}/${expectedCount}`);
    if (migrationHistoryOutdated) {
      console.log(
        "- warning: __drizzle_migrations count is behind local journal, but required schema artifacts exist."
      );
    }
    console.log("- required tables/index: present");
    console.log(`- retention policies rows: ${retentionCount}`);
    console.log(`- required tags: ${Array.from(requiredTagSet).join(", ")}`);
    if (migrationDrift) {
      console.log(
        "- migration drift: detected mismatch between journal and migration files. Resolve drift first (journal/files history sync) before pnpm db:migrate."
      );
    }
  } finally {
    await connection.end();
  }
}

verify().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration verification failed: ${message}`);
  process.exit(1);
});
