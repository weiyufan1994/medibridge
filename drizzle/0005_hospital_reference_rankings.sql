CREATE TABLE "hospital_reference_hospitals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospital_reference_hospitals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"nameEn" varchar(255),
	"normalizedName" varchar(255) NOT NULL,
	"city" varchar(100),
	"cityEn" varchar(100),
	"localHospitalId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_reference_specialties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospital_reference_specialties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"nameEn" varchar(255),
	"normalizedName" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_reference_specialty_rankings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospital_reference_specialty_rankings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalReferenceId" integer NOT NULL,
	"specialtyReferenceId" integer NOT NULL,
	"sourceYear" integer NOT NULL,
	"specialtyRank" integer,
	"specialtyScore" real,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_reference_general_rankings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospital_reference_general_rankings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalReferenceId" integer NOT NULL,
	"sourceYear" integer NOT NULL,
	"rankOrder" integer,
	"grade" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_reference_stem_rankings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospital_reference_stem_rankings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalReferenceId" integer NOT NULL,
	"sourceYear" integer NOT NULL,
	"stemRank" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hospital_reference_hospitals" ADD CONSTRAINT "hospital_reference_hospitals_localHospitalId_hospitals_id_fk" FOREIGN KEY ("localHospitalId") REFERENCES "public"."hospitals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hospital_reference_specialty_rankings" ADD CONSTRAINT "hospital_reference_specialty_rankings_hospitalReferenceId_hospital_reference_hospitals_id_fk" FOREIGN KEY ("hospitalReferenceId") REFERENCES "public"."hospital_reference_hospitals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hospital_reference_specialty_rankings" ADD CONSTRAINT "hospital_reference_specialty_rankings_specialtyReferenceId_hospital_reference_specialties_id_fk" FOREIGN KEY ("specialtyReferenceId") REFERENCES "public"."hospital_reference_specialties"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hospital_reference_general_rankings" ADD CONSTRAINT "hospital_reference_general_rankings_hospitalReferenceId_hospital_reference_hospitals_id_fk" FOREIGN KEY ("hospitalReferenceId") REFERENCES "public"."hospital_reference_hospitals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hospital_reference_stem_rankings" ADD CONSTRAINT "hospital_reference_stem_rankings_hospitalReferenceId_hospital_reference_hospitals_id_fk" FOREIGN KEY ("hospitalReferenceId") REFERENCES "public"."hospital_reference_hospitals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "hospitalRefHospitalsNormalizedUk" ON "hospital_reference_hospitals" USING btree ("normalizedName");
--> statement-breakpoint
CREATE INDEX "hospitalRefHospitalsLocalHospitalIdx" ON "hospital_reference_hospitals" USING btree ("localHospitalId");
--> statement-breakpoint
CREATE UNIQUE INDEX "hospitalRefSpecialtiesNormalizedUk" ON "hospital_reference_specialties" USING btree ("normalizedName");
--> statement-breakpoint
CREATE INDEX "hospitalRefSpecRankHospitalYearIdx" ON "hospital_reference_specialty_rankings" USING btree ("hospitalReferenceId","sourceYear");
--> statement-breakpoint
CREATE INDEX "hospitalRefSpecRankSpecialtyYearIdx" ON "hospital_reference_specialty_rankings" USING btree ("specialtyReferenceId","sourceYear");
--> statement-breakpoint
CREATE UNIQUE INDEX "hospitalRefSpecRankHospitalYearSpecialtyUk" ON "hospital_reference_specialty_rankings" USING btree ("hospitalReferenceId","sourceYear","specialtyReferenceId");
--> statement-breakpoint
CREATE INDEX "hospitalRefGeneralRankYearIdx" ON "hospital_reference_general_rankings" USING btree ("sourceYear");
--> statement-breakpoint
CREATE UNIQUE INDEX "hospitalRefGeneralRankHospitalYearUk" ON "hospital_reference_general_rankings" USING btree ("hospitalReferenceId","sourceYear");
--> statement-breakpoint
CREATE INDEX "hospitalRefStemRankYearIdx" ON "hospital_reference_stem_rankings" USING btree ("sourceYear");
--> statement-breakpoint
CREATE UNIQUE INDEX "hospitalRefStemRankHospitalYearUk" ON "hospital_reference_stem_rankings" USING btree ("hospitalReferenceId","sourceYear");
