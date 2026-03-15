export function getDbErrorCode(error: unknown): string | undefined {
  return (
    (error as { cause?: { code?: string } })?.cause?.code ??
    (error as { code?: string })?.code
  );
}

export function isDuplicateDbError(error: unknown): boolean {
  const code = getDbErrorCode(error);
  return code === "ER_DUP_ENTRY" || code === "23505";
}

export function isForeignKeyDbError(error: unknown): boolean {
  const code = getDbErrorCode(error);
  return code === "ER_NO_REFERENCED_ROW_2" || code === "23503";
}

export function extractAffectedRows(result: unknown): number {
  if (typeof result !== "object" || result === null) {
    return 0;
  }

  if ("rowCount" in result) {
    const value = Number((result as { rowCount?: unknown }).rowCount ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  const header =
    Array.isArray(result) && result.length > 0
      ? (result[0] as { affectedRows?: unknown })
      : (result as { affectedRows?: unknown });
  const value = Number(header?.affectedRows ?? 0);
  return Number.isFinite(value) ? value : 0;
}
