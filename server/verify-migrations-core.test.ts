import { describe, expect, it } from "vitest";
import {
  REQUIRED_INDEXES,
  REQUIRED_TABLES,
  validateRequiredArtifacts,
} from "../scripts/verify-migrations-core";

describe("validateRequiredArtifacts", () => {
  it("accepts the full required artifact set", () => {
    expect(() =>
      validateRequiredArtifacts({
        tableNames: REQUIRED_TABLES,
        indexNames: REQUIRED_INDEXES,
        columns: [{ tableName: "departments", columnName: "url" }],
      })
    ).not.toThrow();
  });

  it("fails when doctor account tables are missing", () => {
    expect(() =>
      validateRequiredArtifacts({
        tableNames: REQUIRED_TABLES.filter(name => name !== "doctor_user_bindings"),
        indexNames: REQUIRED_INDEXES,
        columns: [{ tableName: "departments", columnName: "url" }],
      })
    ).toThrow("Missing required tables: doctor_user_bindings");
  });

  it("fails when doctor account indexes are missing", () => {
    expect(() =>
      validateRequiredArtifacts({
        tableNames: REQUIRED_TABLES,
        indexNames: REQUIRED_INDEXES.filter(
          name => name !== "doctorAccountInvitesTokenHashUk"
        ),
        columns: [{ tableName: "departments", columnName: "url" }],
      })
    ).toThrow("Missing required indexes: doctorAccountInvitesTokenHashUk");
  });
});
