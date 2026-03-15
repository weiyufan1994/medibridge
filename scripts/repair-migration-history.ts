import "../server/_core/loadEnv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

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
  const expectedRows = entries.map(entry => {
    const sqlPath = path.resolve("drizzle", `${entry.tag}.sql`);
    const sql = fs.readFileSync(sqlPath, "utf8");
    return {
      id: entry.idx + 1,
      tag: entry.tag,
      when: entry.when,
      hash: crypto.createHash("sha256").update(sql).digest("hex"),
    };
  });

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  try {
    await pool.query('create schema if not exists drizzle');
    await pool.query(`
      create table if not exists drizzle."__drizzle_migrations" (
        id integer primary key,
        hash text not null,
        created_at bigint not null
      )
    `);

    const existingRows = await pool.query<{ id: number; hash: string; created_at: string }>(
      'select id, hash, created_at from drizzle."__drizzle_migrations" order by id'
    );
    const existingById = new Map(
      existingRows.rows.map(row => [
        Number(row.id),
        {
          hash: String(row.hash),
          createdAt: Number(row.created_at),
        },
      ])
    );

    const insertedIds: number[] = [];
    const updatedIds: number[] = [];

    if (existingRows.rows.length === 0) {
      const baseline = expectedRows[0];
      await pool.query(
        'insert into drizzle."__drizzle_migrations" (id, hash, created_at) values ($1, $2, $3)',
        [baseline.id, baseline.hash, baseline.when]
      );
      insertedIds.push(baseline.id);
    } else {
      for (const row of expectedRows) {
        const existing = existingById.get(row.id);
        if (!existing) {
          continue;
        }
        if (existing.hash !== row.hash || existing.createdAt !== row.when) {
          await pool.query(
            'update drizzle."__drizzle_migrations" set hash = $2, created_at = $3 where id = $1',
            [row.id, row.hash, row.when]
          );
          updatedIds.push(row.id);
        }
      }
    }

    if (insertedIds.length === 0 && updatedIds.length === 0) {
      await pool.query(`
        select setval(
          pg_get_serial_sequence('drizzle."__drizzle_migrations"', 'id'),
          coalesce((select max(id) from drizzle."__drizzle_migrations"), 0),
          true
        )
      `);
      console.log("Migration history already aligned with current baseline.");
      return;
    }

    await pool.query(`
      select setval(
        pg_get_serial_sequence('drizzle."__drizzle_migrations"', 'id'),
        coalesce((select max(id) from drizzle."__drizzle_migrations"), 0),
        true
      )
    `);

    const parts: string[] = [];
    if (insertedIds.length > 0) {
      parts.push(`inserted ids: ${insertedIds.join(", ")}`);
    }
    if (updatedIds.length > 0) {
      parts.push(`updated ids: ${updatedIds.join(", ")}`);
    }
    console.log(`Repaired migration history (${parts.join("; ")}).`);
  } finally {
    await pool.end();
  }
}

repairMigrationHistory().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to repair migration history: ${message}`);
  process.exit(1);
});
