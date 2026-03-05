CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
	`eventId` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`stripeSessionId` varchar(255),
	`appointmentId` int,
	`payloadHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_webhook_events_eventId` PRIMARY KEY(`eventId`)
);
