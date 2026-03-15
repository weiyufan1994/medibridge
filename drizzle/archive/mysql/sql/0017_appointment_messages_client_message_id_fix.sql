-- Fix appointmentMessages client message id column/index safely and idempotently.

-- 1) Drop old unique index when it exists.
SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointmentMessages'
    AND INDEX_NAME = 'appointmentMessagesAppointmentClientMsgUk'
);--> statement-breakpoint

SET @sql := IF(
  @has_old_idx > 0,
  'DROP INDEX appointmentMessagesAppointmentClientMsgUk ON appointmentMessages',
  'SELECT 1'
);--> statement-breakpoint

PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 2) Rename clientMsgId -> clientMessageId when old column still exists.
SET @has_old_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointmentMessages'
    AND COLUMN_NAME = 'clientMsgId'
);--> statement-breakpoint

SET @sql := IF(
  @has_old_col > 0,
  'ALTER TABLE appointmentMessages CHANGE COLUMN clientMsgId clientMessageId varchar(128)',
  'SELECT 1'
);--> statement-breakpoint

PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 3) Create new unique index when it does not exist.
SET @has_new_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointmentMessages'
    AND INDEX_NAME = 'appointmentMessagesAppointmentClientMessageUk'
);--> statement-breakpoint

SET @sql := IF(
  @has_new_idx = 0,
  'CREATE UNIQUE INDEX appointmentMessagesAppointmentClientMessageUk ON appointmentMessages (appointmentId, clientMessageId)',
  'SELECT 1'
);--> statement-breakpoint

PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
