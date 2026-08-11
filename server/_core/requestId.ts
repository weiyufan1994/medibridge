import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function normalizeRequestId(value: string | string[] | undefined) {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim();
  if (
    !candidate ||
    candidate.length > MAX_REQUEST_ID_LENGTH ||
    !SAFE_REQUEST_ID_PATTERN.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const requestId =
    normalizeRequestId(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
