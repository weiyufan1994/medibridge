SET @ddl := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'departments'
      AND COLUMN_NAME = 'url'
  ),
  'SELECT 1',
  'ALTER TABLE `departments` ADD COLUMN `url` varchar(1024) NULL'
);--> statement-breakpoint
PREPARE stmt FROM @ddl;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
