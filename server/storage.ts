// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import fs from "fs/promises";
import path from "path";
import { ENV } from './_core/env';

type ForgeStorageConfig = { mode: "forge"; baseUrl: string; apiKey: string };
type LocalStorageConfig = { mode: "local"; localDir: string };
type StorageConfig = ForgeStorageConfig | LocalStorageConfig;

const DEFAULT_LOCAL_UPLOAD_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "data",
  "uploads"
);
let didWarnLocalStorageFallback = false;
let didWarnForgePlaceholder = false;

export function getLocalUploadDir(): string {
  const configuredDir = process.env.LOCAL_UPLOAD_DIR?.trim();
  if (!configuredDir) {
    return DEFAULT_LOCAL_UPLOAD_DIR;
  }

  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(process.cwd(), configuredDir);
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl?.trim();
  const apiKey = ENV.forgeApiKey?.trim();
  const hasPlaceholderValue =
    (baseUrl ? /your-forge-gateway/i.test(baseUrl) : false) ||
    (apiKey ? /your_forge_key/i.test(apiKey) : false);

  if (baseUrl && apiKey && !hasPlaceholderValue) {
    return { mode: "forge", baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
  }

  if (hasPlaceholderValue && !didWarnForgePlaceholder) {
    didWarnForgePlaceholder = true;
    console.warn(
      "[storage] Forge env contains placeholder values; using local disk storage fallback."
    );
  }

  if (!didWarnLocalStorageFallback) {
    didWarnLocalStorageFallback = true;
    console.warn(
      "[storage] Forge credentials not configured; using local disk storage fallback."
    );
  }

  return { mode: "local", localDir: getLocalUploadDir() };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  let response: Response;
  try {
    response = await fetch(downloadApiUrl, {
      method: "GET",
      headers: buildAuthHeaders(apiKey),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Storage downloadUrl request failed (${downloadApiUrl.toString()}): ${reason}`
    );
  }
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\\/g, "/");
}

function sanitizeLocalKey(relKey: string): string {
  const normalized = path.posix.normalize(normalizeKey(relKey));
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }
  return normalized;
}

function resolveLocalFilePath(localDir: string, relKey: string): string {
  const rootDir = path.resolve(localDir);
  const targetPath = path.resolve(rootDir, relKey);
  if (targetPath !== rootDir && !targetPath.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error(`Storage key resolves outside upload directory: ${relKey}`);
  }
  return targetPath;
}

function encodeUrlKey(relKey: string): string {
  return relKey.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function buildLocalPublicUrl(relKey: string): string {
  return `/uploads/${encodeUrlKey(relKey)}`;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (typeof data === "string") {
    return Buffer.from(data);
  }
  return Buffer.from(data);
}

async function localStoragePut(
  localDir: string,
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const key = sanitizeLocalKey(relKey);
  const filePath = resolveLocalFilePath(localDir, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, toBuffer(data));
  return { key, url: buildLocalPublicUrl(key) };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const config = getStorageConfig();

  if (config.mode === "local") {
    return localStoragePut(config.localDir, key, data);
  }

  const { baseUrl, apiKey } = config;
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Storage upload request failed (${uploadUrl.toString()}): ${reason}`
    );
  }

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);
  const config = getStorageConfig();

  if (config.mode === "local") {
    return { key, url: buildLocalPublicUrl(sanitizeLocalKey(key)) };
  }

  const { baseUrl, apiKey } = config;
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
