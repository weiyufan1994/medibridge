import { afterEach, describe, expect, it } from "vitest";
import { getPublicBaseUrl } from "./getPublicBaseUrl";
import { getRequestMetadata } from "./requestMetadata";

const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }
});

describe("request metadata", () => {
  it("copies only the request fields used beyond the HTTP boundary", () => {
    const metadata = getRequestMetadata({
      headers: {
        host: "internal.medibridge.test",
        "user-agent": "test-agent",
        "x-forwarded-host": "app.medibridge.test, proxy.internal",
        "x-forwarded-proto": "https, http",
        "x-request-id": "request-123",
      },
      ip: " 203.0.113.10 ",
      protocol: "http",
      get: () => "internal.medibridge.test",
    } as never);

    expect(metadata).toEqual({
      clientIp: "203.0.113.10",
      forwardedHost: "app.medibridge.test",
      forwardedProto: "https",
      host: "internal.medibridge.test",
      protocol: "http",
      requestId: "request-123",
      userAgent: "test-agent",
    });
  });

  it("builds the same forwarded public URL from request metadata", () => {
    delete process.env.APP_BASE_URL;

    expect(
      getPublicBaseUrl({
        clientIp: null,
        forwardedHost: "app.medibridge.test",
        forwardedProto: "https",
        host: "internal.medibridge.test",
        protocol: "http",
        requestId: null,
        userAgent: null,
      })
    ).toBe("https://app.medibridge.test");
  });

  it("keeps the configured public URL authoritative", () => {
    process.env.APP_BASE_URL = "https://configured.medibridge.test///";

    expect(getPublicBaseUrl()).toBe("https://configured.medibridge.test");
  });
});
