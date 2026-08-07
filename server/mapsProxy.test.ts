import { describe, expect, it, vi } from "vitest";
import { fetchMapsScript } from "./_core/mapsProxy";

const mapsEnvironment = {
  FORGE_MAPS_PROXY_API_KEY: "maps_test_credential",
  FORGE_MAPS_PROXY_BASE_URL: "https://maps-proxy.example.test/v1/maps/proxy/",
};

describe("maps proxy", () => {
  it("forwards allowlisted parameters without exposing the credential", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response("window.google = { maps: {} };", { status: 200 });
    });

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: { libraries: "marker,places", v: "weekly" },
    });

    expect(result).toMatchObject({ status: 200 });
    expect(result.body).not.toContain(mapsEnvironment.FORGE_MAPS_PROXY_API_KEY);
    const upstreamUrl = new URL(String(fetchImplementation.mock.calls[0]?.[0]));
    expect(upstreamUrl.origin).toBe("https://maps-proxy.example.test");
    expect(upstreamUrl.searchParams.get("key")).toBe(
      mapsEnvironment.FORGE_MAPS_PROXY_API_KEY
    );
    expect(upstreamUrl.searchParams.get("libraries")).toBe("marker,places");
  });

  it("returns 400 for non-allowlisted parameters", async () => {
    const fetchImplementation = vi.fn();

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: { libraries: "drawing", v: "weekly" },
    });

    expect(result.status).toBe(400);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("returns 503 when server-only configuration is missing", async () => {
    const result = await fetchMapsScript({ env: {}, query: {} });

    expect(result.status).toBe(503);
  });

  it.each(["http://maps.example.test", "not-a-url"])(
    "returns 503 for unsafe or malformed upstream %s",
    async baseUrl => {
      const result = await fetchMapsScript({
        env: {
          ...mapsEnvironment,
          FORGE_MAPS_PROXY_BASE_URL: baseUrl,
        },
        query: {},
      });

      expect(result.status).toBe(503);
    }
  );

  it("normalizes an upstream base URL without a trailing slash", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response("window.google = { maps: {} };", { status: 200 });
    });

    const result = await fetchMapsScript({
      env: {
        ...mapsEnvironment,
        FORGE_MAPS_PROXY_BASE_URL:
          "https://maps-proxy.example.test/v1/maps/proxy",
      },
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(200);
    expect(String(fetchImplementation.mock.calls[0]?.[0])).toContain(
      "/v1/maps/proxy/maps/api/js"
    );
  });

  it("follows redirects only within the configured origin", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: "/v1/maps/proxy/redirected.js" },
          status: 302,
        })
      )
      .mockResolvedValueOnce(
        new Response("window.google = { maps: {} };", { status: 200 })
      );

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(200);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("returns 502 for an unsuccessful upstream response", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response("upstream unavailable", { status: 500 });
    });

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(502);
    expect(result.body).not.toContain("upstream unavailable");
  });

  it("returns 502 when the upstream request times out", async () => {
    const fetchImplementation = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
      timeoutMs: 1,
    });

    expect(result.status).toBe(502);
  });

  it("rejects an upstream response that reflects the credential", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response(
        `window.mapsCredential = "${mapsEnvironment.FORGE_MAPS_PROXY_API_KEY}";`,
        { status: 200 }
      );
    });

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(502);
    expect(result.body).not.toContain(mapsEnvironment.FORGE_MAPS_PROXY_API_KEY);
  });

  it("rejects redirects to a different origin", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response(null, {
        headers: { location: "https://attacker.example/maps.js" },
        status: 302,
      });
    });

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(502);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects without a location header", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response(null, { status: 302 });
    });

    const result = await fetchMapsScript({
      env: mapsEnvironment,
      fetchImplementation,
      query: {},
    });

    expect(result.status).toBe(502);
  });
});
