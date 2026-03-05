const ROOM_PATH = "/room";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getRequiredAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) {
    throw new Error("APP_BASE_URL_MISSING");
  }
  return normalizeBaseUrl(configured);
}

export function buildAppointmentAccessLink(token: string): string {
  const baseUrl = getRequiredAppBaseUrl();
  return `${baseUrl}${ROOM_PATH}?token=${encodeURIComponent(token)}`;
}
