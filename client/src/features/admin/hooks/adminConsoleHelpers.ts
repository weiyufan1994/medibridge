export const parseOptionalNonNegativeInteger = (
  value: string
): number | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

export const getAppointmentSelectionScopeKey = (input: {
  amountMaxInput: string;
  amountMinInput: string;
  createdAtFrom: string;
  createdAtTo: string;
  doctorIdInput: string;
  emailQuery: string;
  hasRiskFilter: boolean;
  page: number;
  pageSize: number;
  paymentStatusFilter: string;
  scheduledAtFrom: string;
  scheduledAtTo: string;
  sortBy: string;
  sortDirection: string;
  statusFilter: string;
}) => JSON.stringify(input);

type TranslateFn = (zh: string, en: string) => string;

export function translateAdminConsoleError(
  message: string | undefined,
  tr: TranslateFn
) {
  const raw = (message ?? "").trim();
  if (!raw) {
    return tr("操作失败，请重试。", "Operation failed. Please retry.");
  }
  if (raw === "RETENTION_STORAGE_UNAVAILABLE") {
    return tr(
      "数据保留策略表不可用。请先执行数据库迁移（含 0020）。",
      "Retention storage is unavailable. Run database migrations (including 0020)."
    );
  }
  if (raw.includes("Unknown column") && raw.includes("imageUrl")) {
    return tr(
      "医院封面字段不可用。请执行最新数据库迁移（含 0023）并重启服务。",
      "Hospital cover field is unavailable. Run latest DB migrations (including 0023) and restart the server."
    );
  }
  if (raw.includes("Failed query")) {
    return tr(
      "数据库结构与当前代码不一致。请执行最新数据库迁移并重启服务。",
      "Database schema is out of sync with current code. Run latest migrations and restart the server."
    );
  }
  return raw;
}
