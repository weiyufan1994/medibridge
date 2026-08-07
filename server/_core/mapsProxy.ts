import type { Request, Response } from "express";
import { z } from "zod";

const DEFAULT_MAP_VERSION = "weekly";
const DEFAULT_MAP_LIBRARIES = "marker,places,geocoding,geometry";
const MAPS_SCRIPT_PATH = "maps/api/js";
const MAX_REDIRECTS = 3;
const MAPS_PROXY_TIMEOUT_MS = 10_000;

const allowedLibraries = new Set(["geocoding", "geometry", "marker", "places"]);

const mapsScriptQuerySchema = z
  .object({
    v: z.enum(["weekly", "quarterly", "beta"]).default(DEFAULT_MAP_VERSION),
    libraries: z
      .string()
      .trim()
      .min(1)
      .default(DEFAULT_MAP_LIBRARIES)
      .transform(value => value.split(",").map(item => item.trim()))
      .refine(
        libraries =>
          libraries.length > 0 &&
          new Set(libraries).size === libraries.length &&
          libraries.every(library => allowedLibraries.has(library)),
        "Unsupported map library"
      ),
  })
  .strict();

type FetchImplementation = typeof fetch;

type MapsProxyEnvironment = Readonly<Record<string, string | undefined>>;

interface MapsProxyConfig {
  apiKey: string;
  baseUrl: URL;
}

interface MapsScriptResult {
  body: string;
  contentType: string;
  status: 200 | 400 | 502 | 503;
}

interface FetchMapsScriptOptions {
  env?: MapsProxyEnvironment;
  fetchImplementation?: FetchImplementation;
  query: unknown;
  timeoutMs?: number;
}

function errorResult(
  status: 400 | 502 | 503,
  message: string
): MapsScriptResult {
  return {
    body: message,
    contentType: "text/plain; charset=utf-8",
    status,
  };
}

function resolveConfig(env: MapsProxyEnvironment): MapsProxyConfig | null {
  const apiKey = env.FORGE_MAPS_PROXY_API_KEY?.trim();
  const baseUrlValue = env.FORGE_MAPS_PROXY_BASE_URL?.trim();
  if (!apiKey || !baseUrlValue) {
    return null;
  }

  try {
    const baseUrl = new URL(baseUrlValue);
    if (baseUrl.protocol !== "https:") {
      return null;
    }
    return { apiKey, baseUrl };
  } catch {
    return null;
  }
}

function buildUpstreamUrl(
  config: MapsProxyConfig,
  query: z.infer<typeof mapsScriptQuerySchema>
) {
  const baseUrl = config.baseUrl.toString().endsWith("/")
    ? config.baseUrl
    : new URL(`${config.baseUrl.toString()}/`);
  const upstreamUrl = new URL(MAPS_SCRIPT_PATH, baseUrl);
  upstreamUrl.searchParams.set("key", config.apiKey);
  upstreamUrl.searchParams.set("v", query.v);
  upstreamUrl.searchParams.set("libraries", query.libraries.join(","));
  return upstreamUrl;
}

function isRedirect(response: globalThis.Response) {
  return response.status >= 300 && response.status < 400;
}

async function fetchWithAllowedRedirects(options: {
  fetchImplementation: FetchImplementation;
  signal: AbortSignal;
  upstreamOrigin: string;
  upstreamUrl: URL;
}) {
  let currentUrl = options.upstreamUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await options.fetchImplementation(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: options.signal,
    });
    if (!isRedirect(response)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location || redirectCount === MAX_REDIRECTS) {
      throw new Error("Unsafe maps proxy redirect");
    }

    const redirectUrl = new URL(location, currentUrl);
    if (redirectUrl.origin !== options.upstreamOrigin) {
      throw new Error("Unsafe maps proxy redirect");
    }
    currentUrl = redirectUrl;
  }

  throw new Error("Too many maps proxy redirects");
}

function containsSecret(body: string, apiKey: string) {
  return body.includes(apiKey) || body.includes(encodeURIComponent(apiKey));
}

export async function fetchMapsScript({
  env = process.env,
  fetchImplementation = fetch,
  query,
  timeoutMs = MAPS_PROXY_TIMEOUT_MS,
}: FetchMapsScriptOptions): Promise<MapsScriptResult> {
  const parsedQuery = mapsScriptQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return errorResult(400, "Invalid maps script parameters");
  }

  const config = resolveConfig(env);
  if (!config) {
    return errorResult(503, "Maps service is unavailable");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamUrl = buildUpstreamUrl(config, parsedQuery.data);
    const response = await fetchWithAllowedRedirects({
      fetchImplementation,
      signal: controller.signal,
      upstreamOrigin: config.baseUrl.origin,
      upstreamUrl,
    });
    if (!response.ok) {
      return errorResult(502, "Maps upstream request failed");
    }

    const body = await response.text();
    if (containsSecret(body, config.apiKey)) {
      return errorResult(502, "Maps upstream response was rejected");
    }

    return {
      body,
      contentType: "application/javascript; charset=utf-8",
      status: 200,
    };
  } catch {
    return errorResult(502, "Maps upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleMapsScript(req: Request, res: Response) {
  const result = await fetchMapsScript({ query: req.query });
  res.set({
    "Cache-Control": "private, max-age=300",
    "Content-Type": result.contentType,
    "X-Content-Type-Options": "nosniff",
  });
  res.status(result.status).send(result.body);
}
