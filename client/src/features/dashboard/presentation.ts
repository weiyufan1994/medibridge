export const DASHBOARD_SECTION_VALUES = [
  "account",
  "consultations",
  "appointments",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTION_VALUES)[number];

export function parseDashboardSectionFromSearch(
  search: string | null | undefined
): DashboardSection {
  const section = new URLSearchParams(search ?? "").get("section");

  if (section === "consultations" || section === "appointments") {
    return section;
  }

  return "account";
}
