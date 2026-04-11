ALTER TABLE "referral_orders"
ALTER COLUMN "hospitalId" DROP NOT NULL;

ALTER TABLE "referral_orders"
ALTER COLUMN "departmentId" DROP NOT NULL;

ALTER TABLE "referral_orders"
ADD COLUMN "recommendedHospitalName" varchar(255);

ALTER TABLE "referral_orders"
ADD COLUMN "recommendedDepartmentName" varchar(255);

ALTER TABLE "referral_orders"
ADD COLUMN "recommendedDepartmentNameEn" varchar(255);

ALTER TABLE "referral_orders"
ADD COLUMN "recommendationReason" text;

ALTER TABLE "referral_orders"
ADD COLUMN "manualFulfillmentRequired" integer DEFAULT 0 NOT NULL;
