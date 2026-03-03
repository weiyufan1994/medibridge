ALTER TABLE `appointments` DROP INDEX `doctorTokenHashIdx`;
--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `accessTokenHash`;
--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `doctorTokenHash`;
--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `accessTokenExpiresAt`;
--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `accessTokenRevokedAt`;
--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `doctorTokenRevokedAt`;
