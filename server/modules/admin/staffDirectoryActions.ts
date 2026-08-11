import * as repo from "./repo";

export async function listAssignableStaff() {
  const rows = await repo.listAdminUsers({ limit: 100 });

  return rows
    .filter(row => row.role === "admin" || row.role === "ops")
    .map(row => ({
      id: row.id,
      email: row.email?.trim().toLowerCase() ?? null,
      name: row.name ?? null,
      role: row.role,
    }));
}
