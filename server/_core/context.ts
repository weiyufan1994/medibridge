import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { RequestMetadata } from "@shared/requestMetadata";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { getRequestMetadata } from "./requestMetadata";

export type ContextAuthDependencies = {
  authenticateRequest: (
    req: CreateExpressContextOptions["req"]
  ) => Promise<User>;
  getGuestUserByDeviceId: (deviceId: string) => Promise<User | undefined>;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  userId: number | null;
  deviceId: string | null;
  requestMetadata: RequestMetadata;
};

function getHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }
  return undefined;
}

function getDeviceIdFromRequest(
  req: CreateExpressContextOptions["req"]
): string | null {
  const headerDeviceId = getHeaderValue(req.headers["x-device-id"]);
  if (headerDeviceId) {
    return headerDeviceId;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  const cookieDeviceId = cookies["x-device-id"] ?? cookies.deviceId;
  return typeof cookieDeviceId === "string" && cookieDeviceId.trim().length > 0
    ? cookieDeviceId.trim()
    : null;
}

export async function createContext(
  opts: CreateExpressContextOptions,
  auth: ContextAuthDependencies
): Promise<TrpcContext> {
  let user: User | null = null;
  const deviceId = getDeviceIdFromRequest(opts.req);

  try {
    user = await auth.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && deviceId) {
    user = (await auth.getGuestUserByDeviceId(deviceId)) ?? null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    userId: user?.id ?? null,
    deviceId,
    requestMetadata: getRequestMetadata(opts.req),
  };
}
