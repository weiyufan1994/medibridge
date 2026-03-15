UPDATE `appointments`
SET `status` = 'active'
WHERE `status` IN ('confirmed', 'in_session');--> statement-breakpoint

UPDATE `appointments`
SET `status` = 'ended'
WHERE `status` = 'completed';--> statement-breakpoint

ALTER TABLE `appointments`
MODIFY COLUMN `status` enum(
  'draft',
  'pending_payment',
  'paid',
  'active',
  'ended',
  'expired',
  'refunded',
  'canceled'
) NOT NULL DEFAULT 'draft';--> statement-breakpoint

ALTER TABLE `appointments`
MODIFY COLUMN `paymentStatus` enum(
  'unpaid',
  'pending',
  'paid',
  'failed',
  'expired',
  'refunded',
  'canceled'
) NOT NULL DEFAULT 'unpaid';--> statement-breakpoint

UPDATE `appointments`
SET `paymentStatus` = 'canceled'
WHERE `status` = 'canceled' AND `paymentStatus` IN ('unpaid', 'failed', 'pending');
