import { and, eq } from "drizzle-orm";
import {
  aiChatSessions,
  appointmentMessages,
  appointments,
  InsertUser,
  patientSessions,
  users,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by id: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getGuestUserByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get guest user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.deviceId, deviceId), eq(users.isGuest, 1)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createGuestUser(deviceId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(users).values({
    deviceId,
    isGuest: 1,
    role: "free",
    loginMethod: "guest",
    lastSignedIn: new Date(),
  });

  return getGuestUserByDeviceId(deviceId);
}

export async function findOrCreateGuestUserByDeviceId(deviceId: string) {
  const existingGuest = await getGuestUserByDeviceId(deviceId);
  if (existingGuest) {
    return existingGuest;
  }

  try {
    const created = await createGuestUser(deviceId);
    if (created) {
      return created;
    }
  } catch (error) {
    const raced = await getGuestUserByDeviceId(deviceId);
    if (raced) {
      return raced;
    }
    throw error;
  }

  return undefined;
}

export async function getFormalUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get formal user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.isGuest, 0)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createFormalUser(input: {
  email: string;
  openId: string;
  loginMethod: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(users).values({
    email: input.email,
    openId: input.openId,
    isGuest: 0,
    role: "free",
    loginMethod: input.loginMethod,
    lastSignedIn: new Date(),
  });

  return getFormalUserByEmail(input.email);
}

export async function updateUserById(
  userId: number,
  update: Partial<InsertUser>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(users).set(update).where(eq(users.id, userId));
}

export async function findOrCreateFormalUserByEmail(input: {
  email: string;
  openId: string;
  loginMethod: string;
}) {
  const existing = await getFormalUserByEmail(input.email);
  if (existing) {
    const needsUpdate = !existing.openId || existing.openId.trim().length === 0;
    if (needsUpdate) {
      await updateUserById(existing.id, {
        openId: input.openId,
        loginMethod: input.loginMethod,
        lastSignedIn: new Date(),
        isGuest: 0,
      });
      return (await getFormalUserByEmail(input.email)) ?? existing;
    }

    await updateUserById(existing.id, {
      loginMethod: input.loginMethod,
      lastSignedIn: new Date(),
      isGuest: 0,
    });
    return (await getFormalUserByEmail(input.email)) ?? existing;
  }

  try {
    const created = await createFormalUser(input);
    if (created) {
      return created;
    }
  } catch (error) {
    const raced = await getFormalUserByEmail(input.email);
    if (raced) {
      return raced;
    }
    throw error;
  }

  return undefined;
}

export async function mergeGuestDataIntoFormalUser(input: {
  guestUserId: number;
  formalUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (input.guestUserId === input.formalUserId) {
    return;
  }

  await db
    .update(appointments)
    .set({ userId: input.formalUserId })
    .where(eq(appointments.userId, input.guestUserId));

  await db
    .update(patientSessions)
    .set({ userId: input.formalUserId })
    .where(eq(patientSessions.userId, input.guestUserId));

  await db
    .update(appointmentMessages)
    .set({ userId: input.formalUserId })
    .where(eq(appointmentMessages.userId, input.guestUserId));

  await db
    .update(aiChatSessions)
    .set({ userId: input.formalUserId })
    .where(eq(aiChatSessions.userId, input.guestUserId));
}
