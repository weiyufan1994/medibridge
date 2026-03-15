SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hospitals'
      AND INDEX_NAME = 'hospitalsTranslationStatusIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `hospitals` ADD INDEX `hospitalsTranslationStatusIdx` (`translationStatus`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hospitals'
      AND INDEX_NAME = 'hospitalsTranslationStatusIdIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `hospitals` ADD INDEX `hospitalsTranslationStatusIdIdx` (`translationStatus`, `id`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'departments'
      AND INDEX_NAME = 'departmentsTranslationStatusIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `departments` ADD INDEX `departmentsTranslationStatusIdx` (`translationStatus`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'departments'
      AND INDEX_NAME = 'departmentsTranslationStatusIdIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `departments` ADD INDEX `departmentsTranslationStatusIdIdx` (`translationStatus`, `id`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND INDEX_NAME = 'doctorsTranslationStatusIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD INDEX `doctorsTranslationStatusIdx` (`translationStatus`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND INDEX_NAME = 'doctorsTranslationStatusIdIdx'
  ),
  'SELECT 1',
  'ALTER TABLE `doctors` ADD INDEX `doctorsTranslationStatusIdIdx` (`translationStatus`, `id`)'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
