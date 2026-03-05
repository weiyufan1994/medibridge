-- Remove old unique index if exists
DROP INDEX IF EXISTS appointmentMessagesAppointmentClientMsgUk
ON appointmentMessages;--> statement-breakpoint

-- Rename column clientMsgId -> clientMessageId
ALTER TABLE appointmentMessages
CHANGE COLUMN clientMsgId clientMessageId varchar(128);--> statement-breakpoint

-- Create new unique index
CREATE UNIQUE INDEX appointmentMessagesAppointmentClientMessageUk
ON appointmentMessages (appointmentId, clientMessageId);
