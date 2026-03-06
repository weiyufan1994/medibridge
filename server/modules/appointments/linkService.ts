const VISIT_PATH_PREFIX = "/visit";

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

export function buildAppointmentAccessLink(input: {
  appointmentId: number;
  token: string;
}): string {
  const baseUrl = getRequiredAppBaseUrl();
  return `${baseUrl}${VISIT_PATH_PREFIX}/${input.appointmentId}?t=${encodeURIComponent(
    input.token
  )}`;
}
