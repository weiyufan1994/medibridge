import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

function request(
  protocol: string,
  forwardedProto?: string | string[]
): Request {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as Request;
}

describe("session cookie options", () => {
  it("uses secure cross-site cookies for direct HTTPS requests", () => {
    expect(getSessionCookieOptions(request("https"))).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("uses local-compatible cookies for plain HTTP requests", () => {
    expect(getSessionCookieOptions(request("http"))).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it.each(["http, https", ["http", "HTTPS"]])(
    "trusts an HTTPS hop in forwarded proto %j",
    forwardedProto => {
      expect(
        getSessionCookieOptions(request("http", forwardedProto)).secure
      ).toBe(true);
    }
  );

  it("does not treat a non-HTTPS forwarded protocol as secure", () => {
    expect(getSessionCookieOptions(request("http", "http")).secure).toBe(false);
  });
});
