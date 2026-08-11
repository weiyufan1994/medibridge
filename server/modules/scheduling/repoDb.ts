import { getDb } from "../../db";

type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type DbExecutor = Pick<BaseDb, "select" | "insert" | "update"> &
  Partial<Pick<BaseDb, "delete">>;

export async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}
