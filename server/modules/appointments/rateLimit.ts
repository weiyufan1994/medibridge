const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_FAILURES_PER_IP = 20;

type AttemptBucket = {
  attempts: number[];
};

const byIp = new Map<string, AttemptBucket>();

function getWindowMs(): number {
  const raw = Number(process.env.APPOINTMENT_TOKEN_FAIL_WINDOW_MS ?? DEFAULT_WINDOW_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WINDOW_MS;
}

function getMaxFailures(): number {
  const raw = Number(
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP ?? DEFAULT_MAX_FAILURES_PER_IP
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_FAILURES_PER_IP;
}

function prune(bucket: AttemptBucket, nowMs: number, windowMs: number): void {
  while (bucket.attempts.length > 0 && nowMs - bucket.attempts[0] > windowMs) {
    bucket.attempts.shift();
  }
}

export function checkIpFailureRateLimit(ip: string | null | undefined): boolean {
  if (!ip) {
    return false;
  }

  const nowMs = Date.now();
  const windowMs = getWindowMs();
  const maxFailures = getMaxFailures();
  const bucket = byIp.get(ip) ?? { attempts: [] };
  prune(bucket, nowMs, windowMs);
  byIp.set(ip, bucket);

  return bucket.attempts.length >= maxFailures;
}

export function recordIpFailure(ip: string | null | undefined): void {
  if (!ip) {
    return;
  }

  const nowMs = Date.now();
  const windowMs = getWindowMs();
  const bucket = byIp.get(ip) ?? { attempts: [] };
  prune(bucket, nowMs, windowMs);
  bucket.attempts.push(nowMs);
  byIp.set(ip, bucket);
}

export function resetIpFailures(ip: string | null | undefined): void {
  if (!ip) {
    return;
  }
  byIp.delete(ip);
}

export function clearRateLimitStateForTests() {
  byIp.clear();
}
