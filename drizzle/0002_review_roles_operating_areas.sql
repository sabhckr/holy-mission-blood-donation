CREATE TYPE "public"."availability_source" AS ENUM('donor', 'staff');--> statement-breakpoint
CREATE TYPE "public"."community_affiliation" AS ENUM('independent', 'holy_mission');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."availability_status" ADD VALUE 'unknown';--> statement-breakpoint
ALTER TYPE "public"."donor_profile_status" ADD VALUE 'removed';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'moderator';--> statement-breakpoint
CREATE TABLE "operating_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"public_note" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operating_areas_note_len" CHECK ("operating_areas"."public_note" is null or char_length("operating_areas"."public_note") <= 300)
);
--> statement-breakpoint
ALTER TABLE "availability_updates" ADD COLUMN "source" "availability_source" DEFAULT 'donor' NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_updates" ADD COLUMN "set_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "availability_updates" ADD COLUMN "previous_status" text;--> statement-breakpoint
ALTER TABLE "availability_updates" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "affiliation" "community_affiliation" DEFAULT 'independent' NOT NULL;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD COLUMN "registration_status" "registration_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD COLUMN "registration_reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD COLUMN "registration_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD COLUMN "registration_note" text;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD COLUMN "availability_source" "availability_source";--> statement-breakpoint
ALTER TABLE "operating_areas" ADD CONSTRAINT "operating_areas_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_areas" ADD CONSTRAINT "operating_areas_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operating_areas_location_key" ON "operating_areas" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "availability_updates" ADD CONSTRAINT "availability_updates_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_registration_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("registration_reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donor_profiles_review_idx" ON "donor_profiles" USING btree ("registration_status","created_at");--> statement-breakpoint
-- Donors who registered before the review workflow existed were already public; keep them visible.
UPDATE "donor_profiles" SET "registration_status" = 'approved', "registration_reviewed_at" = "created_at", "registration_note" = 'Registered before registration review existed' WHERE "registration_status" = 'pending';--> statement-breakpoint
UPDATE "donor_profiles" SET "availability_source" = 'donor' WHERE "availability_status" IS NOT NULL AND "availability_source" IS NULL;
