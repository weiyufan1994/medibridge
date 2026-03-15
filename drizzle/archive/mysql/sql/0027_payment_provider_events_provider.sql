ALTER TABLE `stripe_webhook_events`
  ADD COLUMN `provider` enum('stripe', 'paypal') NOT NULL DEFAULT 'stripe';
