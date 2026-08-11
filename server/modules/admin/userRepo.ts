import { and, desc, eq, like, or } from "drizzle-orm";
import { users } from "../../../drizzle/schema";
import { getDb } from "../../db";

export type AdminUserRole = "free" | "pro" | "admin" | "ops";

export async function listAdminUsers(input?: {
  emailQuery?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const normalizedEmailQuery = input?.emailQuery?.trim();
  const filters = [eq(users.isGuest, 0)];
  if (normalizedEmailQuery) {
    filters.push(
      or(
        like(users.email, `%${normalizedEmailQuery}%`),
        like(users.name, `%${normalizedEmailQuery}%`)
      )!
    );
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(desc(users.lastSignedIn), desc(users.id))
    .limit(Math.max(1, Math.min(input?.limit ?? 50, 200)));
}

export async function updateAdminUserRole(input: {
  userId: number;
  role: AdminUserRole;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(users)
    .set({
      role: input.role,
      isGuest: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId));

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  return rows[0] ?? null;
}
