ALTER TABLE `appointmentTokens`
  MODIFY COLUMN `tokenHash` varchar(64) NOT NULL,
  ADD COLUMN `lastUsedAt` timestamp NULL AFTER `expiresAt`,
  ADD COLUMN `useCount` int NOT NULL DEFAULT 0 AFTER `lastUsedAt`,
  ADD COLUMN `maxUses` int NOT NULL DEFAULT 1 AFTER `useCount`,
  ADD COLUMN `revokeReason` text NULL AFTER `revokedAt`,
  ADD COLUMN `createdBy` varchar(64) NULL AFTER `revokeReason`,
  ADD COLUMN `ipFirstSeen` varchar(64) NULL AFTER `createdBy`,
  ADD COLUMN `uaFirstSeen` varchar(512) NULL AFTER `ipFirstSeen`;
--> statement-breakpoint
DROP INDEX `appointmentTokensAppointmentExpiryIdx` ON `appointmentTokens`;
--> statement-breakpoint
DROP INDEX `appointmentTokensTokenHashIdx` ON `appointmentTokens`;
--> statement-breakpoint
CREATE UNIQUE INDEX `appointmentTokensTokenHashUk` ON `appointmentTokens` (`tokenHash`);
--> statement-breakpoint
CREATE INDEX `appointmentTokensExpiresAtIdx` ON `appointmentTokens` (`expiresAt`);
--> statement-breakpoint
CREATE INDEX `appointmentTokensRevokedAtIdx` ON `appointmentTokens` (`revokedAt`);
