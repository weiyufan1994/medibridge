import { describe, expect, it } from "vitest";
import {
  REQUIRED_COLUMNS,
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
        columns: REQUIRED_COLUMNS,
      })
    ).not.toThrow();
  });

  it("fails when doctor account tables are missing", () => {
    expect(() =>
      validateRequiredArtifacts({
        tableNames: REQUIRED_TABLES.filter(name => name !== "doctor_user_bindings"),
        indexNames: REQUIRED_INDEXES,
        columns: REQUIRED_COLUMNS,
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
        columns: REQUIRED_COLUMNS,
      })
    ).toThrow("Missing required indexes: doctorAccountInvitesTokenHashUk");
  });

  it("fails when referral fulfillment columns are missing", () => {
    expect(() =>
      validateRequiredArtifacts({
        tableNames: REQUIRED_TABLES,
        indexNames: REQUIRED_INDEXES,
        columns: REQUIRED_COLUMNS.filter(
          column => column.columnName !== "fulfillmentDeadlineAt"
        ),
      })
    ).toThrow(
      "Missing required columns: referral_orders.fulfillmentDeadlineAt"
    );
  });
});
