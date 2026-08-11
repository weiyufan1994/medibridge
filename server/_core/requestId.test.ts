import { describe, expect, it, vi } from "vitest";
import { REQUEST_ID_HEADER, requestIdMiddleware } from "./requestId";

function runMiddleware(header?: string) {
  const req = { headers: { [REQUEST_ID_HEADER]: header } } as never;
  const res = { setHeader: vi.fn() } as never;
  const next = vi.fn();

  requestIdMiddleware(req, res, next);
  return { req, res, next } as {
    req: { headers: Record<string, string> };
    res: { setHeader: ReturnType<typeof vi.fn> };
    next: ReturnType<typeof vi.fn>;
  };
}

describe("requestIdMiddleware", () => {
  it("preserves a safe incoming request id", () => {
    const { req, res, next } = runMiddleware(" request-123 ");

    expect(req.headers[REQUEST_ID_HEADER]).toBe("request-123");
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      "request-123"
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("replaces an unsafe incoming request id", () => {
    const { req, res, next } = runMiddleware("unsafe request id");
    const requestId = req.headers[REQUEST_ID_HEADER];

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
    expect(next).toHaveBeenCalledOnce();
  });
});
