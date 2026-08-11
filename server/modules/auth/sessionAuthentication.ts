import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "../../../drizzle/schema";
import { createLogger } from "../../_core/logger";
import { sdk } from "../../_core/sdk";
import * as repo from "./repo";

const logger = createLogger("auth_session");

export async function authenticateRequest(
  sessionCookie: string | undefined
): Promise<User> {
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
      logger.error("oauth_user_sync.failed", { error });
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
