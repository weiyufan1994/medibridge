import type { RequestMetadata } from "@shared/requestMetadata";
import type { Request } from "express";

function readHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = raw?.trim();
  return candidate || null;
}

function readForwardedHeader(
  value: string | string[] | undefined
): string | null {
  return readHeader(value)?.split(",")[0]?.trim() || null;
}

export function getRequestMetadata(req: Request): RequestMetadata {
  return {
    clientIp:
      readForwardedHeader(req.headers["x-forwarded-for"]) ||
      req.ip?.trim() ||
      null,
    forwardedHost: readForwardedHeader(req.headers["x-forwarded-host"]),
    forwardedProto: readForwardedHeader(req.headers["x-forwarded-proto"]),
    host: req.get?.("host")?.trim() || readHeader(req.headers.host),
    protocol: req.protocol?.trim() || null,
    requestId: readHeader(req.headers["x-request-id"]),
    userAgent: readHeader(req.headers["user-agent"]),
  };
}
