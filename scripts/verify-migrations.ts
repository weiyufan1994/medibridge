import "../server/_core/loadEnv";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

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
  if (expectedCount === 0) {
    throw new Error("Local drizzle journal has no PostgreSQL baseline entries");
  }
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

  const requiredTagSet = new Set(journalTags);

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const migrationTableRows = await pool.query<{ exists: string | null }>(
      "select to_regclass('drizzle.__drizzle_migrations') as exists"
    );
    if (!migrationTableRows.rows[0]?.exists) {
      throw new Error("Missing drizzle.__drizzle_migrations table");
    }

    const migrationRows = await pool.query<{ count: string }>(
      'select count(*) as count from drizzle."__drizzle_migrations"'
    );
    const appliedCount = Number(migrationRows.rows[0]?.count ?? 0);
    const migrationHistoryOutdated = appliedCount < expectedCount;

    const tableRows = await pool.query<{ tableName: string }>(
      `select table_name as "tableName"
       from information_schema.tables
       where table_schema = current_schema()
         and table_name in ('appointment_visit_summaries','visit_retention_policies','retention_cleanup_audits')
       order by table_name`
    );
    const existingTables = new Set(
      tableRows.rows.map(row => row.tableName)
    );
    const missingTables = [
      "appointment_visit_summaries",
      "visit_retention_policies",
      "retention_cleanup_audits",
    ].filter(name => !existingTables.has(name));
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
    }

    const indexRows = await pool.query<{ indexName: string }>(
      `select indexname as "indexName"
       from pg_indexes
       where schemaname = current_schema()
         and tablename = 'appointmentMessages'
         and indexname = 'appointmentMessagesAppointmentCreatedAtIdx'`
    );
    if (indexRows.rows.length === 0) {
      throw new Error("Missing required index: appointmentMessagesAppointmentCreatedAtIdx");
    }

    const departmentUrlRows = await pool.query<{ columnName: string }>(
      `select column_name as "columnName"
       from information_schema.columns
       where table_schema = current_schema()
         and table_name = 'departments'
         and column_name = 'url'
       limit 1`
    );
    if (departmentUrlRows.rows.length === 0) {
      throw new Error("Missing required column: departments.url");
    }

    const vectorExtensionRows = await pool.query<{ extname: string }>(
      `select extname
       from pg_extension
       where extname = 'vector'
       limit 1`
    );
    if (vectorExtensionRows.rows.length === 0) {
      throw new Error("Missing required PostgreSQL extension: vector");
    }

    const embeddingVectorColumnRows = await pool.query<{ columnName: string }>(
      `select column_name as "columnName"
       from information_schema.columns
       where table_schema = current_schema()
         and table_name = 'doctorEmbeddings'
         and column_name = 'embeddingVector'
       limit 1`
    );
    if (embeddingVectorColumnRows.rows.length === 0) {
      throw new Error("Missing required column: doctorEmbeddings.embeddingVector");
    }

    const vectorIndexRows = await pool.query<{ indexName: string }>(
      `select indexname as "indexName"
       from pg_indexes
       where schemaname = current_schema()
         and tablename = 'doctorEmbeddings'
         and indexname = 'doctorEmbeddingsVectorIdx'`
    );
    if (vectorIndexRows.rows.length === 0) {
      throw new Error("Missing required index: doctorEmbeddingsVectorIdx");
    }

    const retentionRows = await pool.query<{ count: string }>(
      "select count(*) as count from visit_retention_policies"
    );
    const retentionCount = Number(retentionRows.rows[0]?.count ?? 0);
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
    console.log("- required tables/index/extensions: present");
    console.log(`- retention policies rows: ${retentionCount}`);
    console.log(`- required tags: ${Array.from(requiredTagSet).join(", ")}`);
    if (migrationDrift) {
      console.log(
        "- migration drift: detected mismatch between journal and migration files. Resolve drift first (journal/files history sync) before pnpm db:migrate."
      );
    }
  } finally {
    await pool.end();
  }
}

verify().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration verification failed: ${message}`);
  process.exit(1);
});
