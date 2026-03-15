INSERT INTO "visit_retention_policies" ("tier", "retentionDays", "enabled")
VALUES
  ('free', 7, 1),
  ('paid', 180, 1)
ON CONFLICT ("tier") DO NOTHING;
