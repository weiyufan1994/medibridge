SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'doctorTokenHash'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `doctorTokenHash` varchar(128)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint
SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'doctorTokenRevokedAt'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `doctorTokenRevokedAt` timestamp'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint
SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'doctorLastAccessAt'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `doctorLastAccessAt` timestamp'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint
SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND INDEX_NAME = 'doctorTokenHashIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD INDEX `doctorTokenHashIdx` (`doctorTokenHash`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
