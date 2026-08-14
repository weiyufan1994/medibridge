type ClientLogger = {
  error: (event: string, error: unknown) => void;
};

const SAFE_LABEL = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "AggregateError",
  "DOMException",
  "Error",
  "NetworkError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TRPCClientError",
  "TypeError",
  "URIError",
]);
const SAFE_ERROR_CODES = new Set([
  "BAD_GATEWAY",
  "BAD_REQUEST",
  "CLIENT_CLOSED_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "GATEWAY_TIMEOUT",
  "INTERNAL_SERVER_ERROR",
  "METHOD_NOT_SUPPORTED",
  "NOT_FOUND",
  "NOT_IMPLEMENTED",
  "PARSE_ERROR",
  "PAYLOAD_TOO_LARGE",
  "PAYMENT_REQUIRED",
  "PRECONDITION_FAILED",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
  "UNPROCESSABLE_CONTENT",
  "UNSUPPORTED_MEDIA_TYPE",
]);

function normalizeLabel(value: string, fallback: string) {
  const normalized = value.trim();
  return SAFE_LABEL.test(normalized) ? normalized : fallback;
}

function getErrorName(error: unknown) {
  try {
    if (error && typeof error === "object" && "name" in error) {
      const name = (error as { name?: unknown }).name;
      if (typeof name === "string") {
        return SAFE_ERROR_NAMES.has(name) ? name : "UnknownError";
      }
    }
  } catch {
    return "UnknownError";
  }

  return error === null ? "null" : typeof error;
}

function getErrorCode(error: unknown) {
  try {
    if (!error || typeof error !== "object") {
      return undefined;
    }

    const candidate = error as {
      code?: unknown;
      data?: { code?: unknown } | null;
    };
    const code = candidate.data?.code ?? candidate.code;
    return typeof code === "string" && SAFE_ERROR_CODES.has(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

export function createClientLogger(component: string): ClientLogger {
  const safeComponent = normalizeLabel(component, "client");

  return {
    error(event, error) {
      const errorCode = getErrorCode(error);
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: safeComponent,
          event: normalizeLabel(event, "error.unclassified"),
          errorName: getErrorName(error),
          ...(errorCode ? { errorCode } : {}),
        })
      );
    },
  };
}
