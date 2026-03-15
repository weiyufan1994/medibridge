-- Remove old unique index if exists (compatible with MySQL versions without DROP INDEX IF EXISTS)
SET @old_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'appointmentMessages'
    AND index_name = 'appointmentMessagesAppointmentClientMsgUk'
);--> statement-breakpoint
SET @drop_old_idx_sql := IF(
  @old_idx_exists > 0,
  'DROP INDEX appointmentMessagesAppointmentClientMsgUk ON appointmentMessages',
  'SELECT 1'
);--> statement-breakpoint
PREPARE drop_old_idx_stmt FROM @drop_old_idx_sql;--> statement-breakpoint
EXECUTE drop_old_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE drop_old_idx_stmt;--> statement-breakpoint

-- Rename column clientMsgId -> clientMessageId only when legacy column exists
SET @legacy_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'appointmentMessages'
    AND column_name = 'clientMsgId'
);--> statement-breakpoint
SET @rename_col_sql := IF(
  @legacy_col_exists > 0,
  'ALTER TABLE appointmentMessages CHANGE COLUMN clientMsgId clientMessageId varchar(128)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE rename_col_stmt FROM @rename_col_sql;--> statement-breakpoint
EXECUTE rename_col_stmt;--> statement-breakpoint
DEALLOCATE PREPARE rename_col_stmt;--> statement-breakpoint

-- Create new unique index if not exists
SET @new_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'appointmentMessages'
    AND index_name = 'appointmentMessagesAppointmentClientMessageUk'
);--> statement-breakpoint
SET @create_new_idx_sql := IF(
  @new_idx_exists = 0,
  'CREATE UNIQUE INDEX appointmentMessagesAppointmentClientMessageUk ON appointmentMessages (appointmentId, clientMessageId)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE create_new_idx_stmt FROM @create_new_idx_sql;--> statement-breakpoint
EXECUTE create_new_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE create_new_idx_stmt;
