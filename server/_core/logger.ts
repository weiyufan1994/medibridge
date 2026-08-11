export type LogFields = Record<string, unknown>;

type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const SENSITIVE_KEY_PARTS = new Set([
  "authorization",
  "cookie",
  "email",
  "password",
  "secret",
  "token",
]);

function normalizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSensitiveKey(key: string) {
  const parts = normalizeKey(key);
  if (parts.some(part => SENSITIVE_KEY_PARTS.has(part))) {
    return true;
  }
  const normalized = parts.join("_");
  return normalized.includes("api_key") || normalized.includes("database_url");
}

function redactString(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(
      /\b(?:postgres(?:ql)?|mysql):\/\/[^\s]+/gi,
      "[REDACTED_DATABASE_URL]"
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /([?&](?:token|api[_-]?key|key|secret)=)[^&\s]+/gi,
      "$1[REDACTED]"
    );
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (depth >= MAX_DEPTH) {
    return "[TRUNCATED]";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1, seen),
    ])
  );
}

function writeLog(
  level: LogLevel,
  component: string,
  event: string,
  baseFields: LogFields,
  fields: LogFields
) {
  const timestamp = new Date().toISOString();
  let serialized: string;
  try {
    const payload = redactValue(
      {
        timestamp,
        level,
        component,
        event,
        ...baseFields,
        ...fields,
      },
      0,
      new WeakSet()
    );
    serialized = JSON.stringify(payload);
  } catch {
    serialized = JSON.stringify({
      timestamp,
      level,
      component: redactString(component),
      event: redactString(event),
      loggingError: "Failed to serialize log fields",
    });
  }

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else if (level === "debug") {
    console.debug(serialized);
  } else {
    console.info(serialized);
  }
}

export function createLogger(component: string, baseFields: LogFields = {}) {
  return {
    debug: (event: string, fields: LogFields = {}) =>
      writeLog("debug", component, event, baseFields, fields),
    info: (event: string, fields: LogFields = {}) =>
      writeLog("info", component, event, baseFields, fields),
    warn: (event: string, fields: LogFields = {}) =>
      writeLog("warn", component, event, baseFields, fields),
    error: (event: string, fields: LogFields = {}) =>
      writeLog("error", component, event, baseFields, fields),
  };
}
