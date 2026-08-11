import { getDb } from "../../db";

type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type AppointmentRepoExecutor = Pick<
  BaseDb,
  "select" | "insert" | "update"
>;

export async function resolveAppointmentRepoExecutor(
  dbExecutor?: AppointmentRepoExecutor
) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}
