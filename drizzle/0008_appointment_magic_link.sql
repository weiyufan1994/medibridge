ALTER TABLE `appointments` MODIFY COLUMN `status` enum('pending','confirmed','rescheduled','completed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'email'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `email` varchar(320) NOT NULL DEFAULT '''''''
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
      AND COLUMN_NAME = 'accessTokenHash'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `accessTokenHash` varchar(128) NOT NULL DEFAULT '''''''
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
      AND COLUMN_NAME = 'accessTokenExpiresAt'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `accessTokenExpiresAt` timestamp NULL'
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
      AND COLUMN_NAME = 'accessTokenRevokedAt'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `accessTokenRevokedAt` timestamp'
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
      AND COLUMN_NAME = 'lastAccessAt'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `lastAccessAt` timestamp'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint
UPDATE `appointments`
SET `accessTokenExpiresAt` = DATE_ADD(NOW(), INTERVAL 7 DAY)
WHERE `accessTokenExpiresAt` IS NULL;--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `accessTokenExpiresAt` timestamp NOT NULL;--> statement-breakpoint
SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointments'
      AND INDEX_NAME = 'emailIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD INDEX `emailIdx` (`email`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
