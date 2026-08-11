import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { User } from "../../../drizzle/schema";
import { sdk } from "../../_core/sdk";
import * as repo from "./repo";

export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const sessionCookie = cookies[COOKIE_NAME];
  const session = await sdk.verifySession(sessionCookie);

  if (!session) {
    throw ForbiddenError("Invalid session cookie");
  }

  const signedInAt = new Date();
  let user = await repo.getUserByOpenId(session.openId);

  if (!user) {
    try {
      const userInfo = await sdk.getUserInfoWithJwt(sessionCookie ?? "");
      await repo.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: signedInAt,
      });
      user = await repo.getUserByOpenId(userInfo.openId);
    } catch (error) {
      console.error("[Auth] Failed to sync user from OAuth:", error);
      throw ForbiddenError("Failed to sync user info");
    }
  }

  if (!user) {
    throw ForbiddenError("User not found");
  }

  await repo.upsertUser({
    openId: user.openId,
    lastSignedIn: signedInAt,
  });

  return user;
}
