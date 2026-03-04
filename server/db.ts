import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool({
        uri: process.env.DATABASE_URL,
        timezone: "Z",
      });
      _pool.on("connection", connection => {
        connection.query("SET time_zone = '+00:00'");
      });
      await _pool.promise().query("SET time_zone = '+00:00'");
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}
