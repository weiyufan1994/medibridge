ALTER TABLE `appointments`
  ADD COLUMN `paymentProvider` enum('stripe', 'paypal') NOT NULL DEFAULT 'stripe';
