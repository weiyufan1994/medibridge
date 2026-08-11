import type { RequestMetadata } from "@shared/requestMetadata";
import type { Request } from "express";

function readHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = raw?.split(",")[0]?.trim();
  return candidate || null;
}

export function getRequestMetadata(req: Request): RequestMetadata {
  return {
    clientIp: req.ip?.trim() || null,
    forwardedHost: readHeader(req.headers["x-forwarded-host"]),
    forwardedProto: readHeader(req.headers["x-forwarded-proto"]),
    host: req.get?.("host")?.trim() || readHeader(req.headers.host),
    protocol: req.protocol?.trim() || null,
    requestId: readHeader(req.headers["x-request-id"]),
    userAgent: readHeader(req.headers["user-agent"]),
  };
}
