import type { RequestMetadata } from "@shared/requestMetadata";
import type { Request } from "express";
import { getRequestMetadata } from "./requestMetadata";

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:3000";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function isExpressRequest(input: Request | RequestMetadata): input is Request {
  return "headers" in input;
}

export function getPublicBaseUrl(input?: Request | RequestMetadata): string {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (input) {
    const metadata = isExpressRequest(input)
      ? getRequestMetadata(input)
      : input;
    const protocol = metadata.forwardedProto || metadata.protocol || "http";
    const host = metadata.forwardedHost || metadata.host || "localhost:3000";
    return normalizeBaseUrl(`${protocol}://${host}`);
  }

  return DEFAULT_PUBLIC_BASE_URL;
}
