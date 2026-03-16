export const REQUIRED_TABLES = [
  "appointment_visit_summaries",
  "visit_retention_policies",
  "retention_cleanup_audits",
  "doctor_user_bindings",
  "doctor_account_invites",
] as const;

export const REQUIRED_INDEXES = [
  "appointmentMessagesAppointmentCreatedAtIdx",
  "doctorUserBindingsDoctorIdx",
  "doctorUserBindingsUserIdx",
  "doctorUserBindingsStatusIdx",
  "doctorUserBindingsEmailIdx",
  "doctorAccountInvitesDoctorIdx",
  "doctorAccountInvitesEmailIdx",
  "doctorAccountInvitesStatusIdx",
  "doctorAccountInvitesExpiresIdx",
  "doctorAccountInvitesTokenHashUk",
  "doctorUserBindingsDoctorActiveUk",
  "doctorUserBindingsUserActiveUk",
] as const;

export const REQUIRED_COLUMNS = [
  {
    tableName: "departments",
    columnName: "url",
  },
] as const;

export function findMissingValues(
  requiredValues: readonly string[],
  actualValues: Iterable<string>
) {
  const existing = new Set(actualValues);
  return requiredValues.filter(value => !existing.has(value));
}

export function validateRequiredArtifacts(input: {
  tableNames: Iterable<string>;
  indexNames: Iterable<string>;
  columns: Iterable<{ tableName: string; columnName: string }>;
}) {
  const missingTables = findMissingValues(REQUIRED_TABLES, input.tableNames);
  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
  }

  const missingIndexes = findMissingValues(REQUIRED_INDEXES, input.indexNames);
  if (missingIndexes.length > 0) {
    throw new Error(`Missing required indexes: ${missingIndexes.join(", ")}`);
  }

  const availableColumns = new Set(
    Array.from(input.columns, column => `${column.tableName}.${column.columnName}`)
  );
  const missingColumns = REQUIRED_COLUMNS.filter(
    column => !availableColumns.has(`${column.tableName}.${column.columnName}`)
  ).map(column => `${column.tableName}.${column.columnName}`);

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }
}
