import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createLogger } from "./_core/logger";

const logger = createLogger("database");

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        options: "-c timezone=UTC",
      });
      _db = drizzle(_pool);
    } catch (error) {
      logger.warn("connection_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      _db = null;
      _pool = null;
    }
  }
  return _db;
}
