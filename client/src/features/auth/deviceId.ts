const DEVICE_ID_STORAGE_KEY = "deviceId";

function generateDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const created = generateDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}
