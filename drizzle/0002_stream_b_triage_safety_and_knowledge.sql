CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "triage_knowledge_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "triage_knowledge_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceType" varchar(64) DEFAULT 'internal_card' NOT NULL,
	"title" varchar(255) NOT NULL,
	"lang" varchar(8) DEFAULT 'zh' NOT NULL,
	"body" text NOT NULL,
	"version" varchar(32) DEFAULT 'v1' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"sourceUrl" varchar(1024),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_knowledge_chunks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "triage_knowledge_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"documentId" integer NOT NULL,
	"chunkIndex" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specialtyTags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"riskCodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embeddingVector" vector(1024),
	"embeddingModel" varchar(128),
	"embeddingDimensions" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "triage_knowledge_chunks_documentId_triage_knowledge_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."triage_knowledge_documents"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "triage_risk_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "triage_risk_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" integer NOT NULL,
	"messageId" integer,
	"riskCode" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"recommendedAction" varchar(64) NOT NULL,
	"triggerSource" varchar(32) DEFAULT 'rule' NOT NULL,
	"rawExcerpt" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "triage_risk_events_sessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "triage_risk_events_messageId_ai_chat_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."ai_chat_messages"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "triage_session_flags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "triage_session_flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" integer NOT NULL,
	"flagType" varchar(64) NOT NULL,
	"flagValue" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "triage_session_flags_sessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "triage_consents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "triage_consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer,
	"sessionId" integer NOT NULL,
	"consentType" varchar(64) DEFAULT 'triage_disclaimer' NOT NULL,
	"consentVersion" varchar(32) DEFAULT 'stream_b_v1' NOT NULL,
	"acceptedAt" timestamp DEFAULT now() NOT NULL,
	"lang" varchar(8) DEFAULT 'zh' NOT NULL,
	CONSTRAINT "triage_consents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "triage_consents_sessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "triageKnowledgeDocumentsSourceTypeIdx" ON "triage_knowledge_documents" USING btree ("sourceType");
--> statement-breakpoint
CREATE INDEX "triageKnowledgeDocumentsStatusIdx" ON "triage_knowledge_documents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "triageKnowledgeChunksDocumentChunkIdx" ON "triage_knowledge_chunks" USING btree ("documentId","chunkIndex");
--> statement-breakpoint
CREATE INDEX "triageRiskEventsSessionCreatedIdx" ON "triage_risk_events" USING btree ("sessionId","createdAt");
--> statement-breakpoint
CREATE INDEX "triageRiskEventsRiskCodeIdx" ON "triage_risk_events" USING btree ("riskCode");
--> statement-breakpoint
CREATE INDEX "triageSessionFlagsSessionFlagTypeIdx" ON "triage_session_flags" USING btree ("sessionId","flagType");
--> statement-breakpoint
CREATE INDEX "triageConsentsSessionConsentTypeIdx" ON "triage_consents" USING btree ("sessionId","consentType");
--> statement-breakpoint
CREATE INDEX "triageKnowledgeChunksEmbeddingVectorIdx" ON "triage_knowledge_chunks" USING hnsw ("embeddingVector" vector_cosine_ops);
