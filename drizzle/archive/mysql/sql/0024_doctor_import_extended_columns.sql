SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'sourceDoctorId'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `sourceDoctorId` varchar(128) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'totalPatients'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `totalPatients` varchar(100) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'totalArticles'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `totalArticles` varchar(100) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'totalVisits'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `totalVisits` varchar(100) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'scrapedDate'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `scrapedDate` varchar(100) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'scrapedStatus'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `scrapedStatus` varchar(64) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'dataSource'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `dataSource` varchar(255) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'educationExperience'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `educationExperience` text NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'socialRole'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `socialRole` text NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'researchAchievements'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `researchAchievements` text NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'honors'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `honors` text NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'followUpPatients'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `followUpPatients` varchar(100) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'followUpFeedback'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `followUpFeedback` text NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'gender'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `gender` varchar(20) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'sequenceNumber'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD COLUMN `sequenceNumber` int NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
