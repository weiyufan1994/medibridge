import type { Request } from "express";

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:3000";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function readForwardedHeader(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = raw?.split(",")[0]?.trim();
  return candidate || undefined;
}

export function getPublicBaseUrl(req?: Request): string {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (req) {
    const forwardedProto = readForwardedHeader(req.headers["x-forwarded-proto"]);
    const forwardedHost = readForwardedHeader(req.headers["x-forwarded-host"]);
    const protocol = forwardedProto || req.protocol || "http";
    const host = forwardedHost || req.get("host") || req.headers.host || "localhost:3000";
    return normalizeBaseUrl(`${protocol}://${host}`);
  }

  return DEFAULT_PUBLIC_BASE_URL;
}
