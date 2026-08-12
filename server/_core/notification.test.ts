import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const forgeApiKey = "private-notification-key";

describe("notifyOwner logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./env", () => ({
      ENV: {
        forgeApiUrl: "https://notification.example/",
        forgeApiKey,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock("./env");
    vi.resetModules();
  });

  it("logs an upstream rejection without response or payload content", async () => {
    const responseDetail = "rejected private notification content";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(responseDetail, {
          status: 503,
          statusText: `Unavailable ${forgeApiKey}`,
        })
      )
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { notifyOwner } = await import("./notification");

    await expect(
      notifyOwner({
        title: "private title",
        content: "private patient notification",
      })
    ).resolves.toBe(false);

    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "notification",
      event: "upstream_rejected",
      status: 503,
    });
    expect(logged).not.toContain(responseDetail);
    expect(logged).not.toContain("private title");
    expect(logged).not.toContain("private patient notification");
    expect(logged).not.toContain(forgeApiKey);
  });

  it("logs only the failure type when the request throws", async () => {
    const endpointDetail =
      "https://notification.example/?token=private-request-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError(endpointDetail))
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { notifyOwner } = await import("./notification");

    await expect(
      notifyOwner({ title: "private title", content: "private content" })
    ).resolves.toBe(false);

    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "notification",
      event: "upstream_request_failed",
      errorName: "TypeError",
    });
    expect(logged).not.toContain(endpointDetail);
    expect(logged).not.toContain("private-request-token");
  });
});
