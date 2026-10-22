CREATE TYPE "public"."account_status" AS ENUM('active', 'deactivated', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."blood_group" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."community_kind" AS ENUM('blood_organization', 'volunteer_group', 'student_group', 'religious_group', 'hospital_support', 'other');--> statement-breakpoint
CREATE TYPE "public"."community_status" AS ENUM('pending', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('call', 'sms', 'whatsapp', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."contact_request_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."deletion_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('not_configured', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."donation_source" AS ENUM('self_reported', 'community', 'admin');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('unverified', 'pending', 'verified', 'rejected', 'voided');--> statement-breakpoint
CREATE TYPE "public"."donation_type" AS ENUM('whole_blood', 'double_red_cells', 'platelets', 'plasma');--> statement-breakpoint
CREATE TYPE "public"."donor_profile_status" AS ENUM('active', 'paused', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."duplicate_decision" AS ENUM('not_duplicate', 'duplicate_resolved');--> statement-breakpoint
CREATE TYPE "public"."location_level" AS ENUM('division', 'district', 'upazila');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('member', 'coordinator', 'leader');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending', 'active', 'rejected', 'removed', 'left');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'sms', 'email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('fake_information', 'wrong_number', 'harassment', 'spam', 'payment_demand', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('donor', 'community', 'request', 'user');--> statement-breakpoint
CREATE TYPE "public"."request_contact_preference" AS ENUM('call', 'sms', 'whatsapp', 'coordinator_only');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'in_progress', 'fulfilled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."request_urgency" AS ENUM('critical', 'urgent', 'normal');--> statement-breakpoint
CREATE TYPE "public"."response_status" AS ENUM('offered', 'confirmed', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'signed_in', 'coordinators', 'private');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"community_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"status" "availability_status" NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "availability_updates_expiry" CHECK (("availability_updates"."status" = 'available') = ("availability_updates"."expires_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "blood_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"blood_group" "blood_group" NOT NULL,
	"units" smallint NOT NULL,
	"division_id" integer NOT NULL,
	"district_id" integer NOT NULL,
	"upazila_id" integer,
	"hospital_name" text NOT NULL,
	"needed_at" timestamp with time zone NOT NULL,
	"urgency" "request_urgency" DEFAULT 'normal' NOT NULL,
	"requester_name" text NOT NULL,
	"requester_phone" text NOT NULL,
	"contact_preference" "request_contact_preference" DEFAULT 'call' NOT NULL,
	"share_phone_with_responders" boolean DEFAULT false NOT NULL,
	"note" text,
	"show_on_public_board" boolean DEFAULT true NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"status_reason" text,
	"created_by_user_id" uuid,
	"manage_token_hash" text,
	"assigned_community_id" uuid,
	"assigned_coordinator_id" uuid,
	"dedupe_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blood_requests_units" CHECK ("blood_requests"."units" between 1 and 20),
	CONSTRAINT "blood_requests_note_len" CHECK ("blood_requests"."note" is null or char_length("blood_requests"."note") <= 300)
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"kind" "community_kind" DEFAULT 'volunteer_group' NOT NULL,
	"description" text,
	"founded_year" smallint,
	"status" "community_status" DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"division_id" integer NOT NULL,
	"district_id" integer NOT NULL,
	"public_phone" text,
	"public_email" text,
	"facebook_url" text,
	"show_public_contact" boolean DEFAULT false NOT NULL,
	"coordinator_contact_preference" text DEFAULT 'in_app' NOT NULL,
	"created_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communities_contact_pref" CHECK ("communities"."coordinator_contact_preference" in ('in_app', 'phone', 'both')),
	CONSTRAINT "communities_description_len" CHECK ("communities"."description" is null or char_length("communities"."description") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "community_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_service_areas" (
	"community_id" uuid NOT NULL,
	"location_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_service_areas_community_id_location_id_pk" PRIMARY KEY("community_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"blood_request_id" uuid,
	"message" text NOT NULL,
	"status" "contact_request_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_requests_message_len" CHECK (char_length("contact_requests"."message") between 1 and 300)
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text,
	"status" "deletion_status" DEFAULT 'pending' NOT NULL,
	"processed_by_user_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"from_status" "donation_status",
	"to_status" "donation_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"donated_on" date NOT NULL,
	"donation_type" "donation_type" NOT NULL,
	"source" "donation_source" NOT NULL,
	"status" "donation_status" DEFAULT 'unverified' NOT NULL,
	"review_community_id" uuid,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone,
	"review_note" text,
	"place" text,
	"note" text,
	"voided_reason" text,
	"corrects_donation_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_place_len" CHECK ("donations"."place" is null or char_length("donations"."place") <= 120),
	CONSTRAINT "donations_note_len" CHECK ("donations"."note" is null or char_length("donations"."note") <= 300)
);
--> statement-breakpoint
CREATE TABLE "donor_consents" (
	"donor_id" uuid PRIMARY KEY NOT NULL,
	"listed_in_search" boolean DEFAULT false NOT NULL,
	"name_visibility" "visibility" DEFAULT 'signed_in' NOT NULL,
	"phone_visibility" "visibility" DEFAULT 'private' NOT NULL,
	"locality_visibility" "visibility" DEFAULT 'signed_in' NOT NULL,
	"donation_history_visibility" "visibility" DEFAULT 'private' NOT NULL,
	"community_visibility" "visibility" DEFAULT 'public' NOT NULL,
	"allow_coordinator_contact" boolean DEFAULT false NOT NULL,
	"allow_contact_requests" boolean DEFAULT true NOT NULL,
	"policy_version" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donor_consents_phone_not_public" CHECK ("donor_consents"."phone_visibility" <> 'public')
);
--> statement-breakpoint
CREATE TABLE "donor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"full_name" text NOT NULL,
	"name_key" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"blood_group" "blood_group" NOT NULL,
	"division_id" integer NOT NULL,
	"district_id" integer NOT NULL,
	"upazila_id" integer,
	"locality" text,
	"contact_phone" text NOT NULL,
	"preferred_contact_method" "contact_method" DEFAULT 'call' NOT NULL,
	"status" "donor_profile_status" DEFAULT 'active' NOT NULL,
	"restricted_reason" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_community_id" uuid,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone,
	"availability_status" "availability_status",
	"availability_confirmed_at" timestamp with time zone,
	"availability_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donor_profiles_locality_len" CHECK ("donor_profiles"."locality" is null or char_length("donor_profiles"."locality") <= 80)
);
--> statement-breakpoint
CREATE TABLE "duplicate_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_a" uuid NOT NULL,
	"donor_b" uuid NOT NULL,
	"decision" "duplicate_decision" NOT NULL,
	"reviewed_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_reviews_order" CHECK ("duplicate_reviews"."donor_a" < "duplicate_reviews"."donor_b")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"level" "location_level" NOT NULL,
	"code" text NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_parent_level_check" CHECK (("locations"."level" = 'division' and "locations"."parent_id" is null) or ("locations"."level" <> 'division' and "locations"."parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"provider" text NOT NULL,
	"status" "delivery_status" NOT NULL,
	"provider_ref" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"reporter_user_id" uuid,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"handled_by_user_id" uuid,
	"handled_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_len" CHECK ("reports"."details" is null or char_length("reports"."details") <= 500)
);
--> statement-breakpoint
CREATE TABLE "request_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_community_id" uuid,
	"to_community_id" uuid NOT NULL,
	"escalated_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"status" "response_status" DEFAULT 'offered' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"preferred_locale" text DEFAULT 'bn' NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"failed_sign_in_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_locale_check" CHECK ("users"."preferred_locale" in ('bn', 'en'))
);
--> statement-breakpoint
CREATE TABLE "verification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"community_id" uuid,
	"from_status" "verification_status" NOT NULL,
	"to_status" "verification_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_updates" ADD CONSTRAINT "availability_updates_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_division_id_locations_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_upazila_id_locations_id_fk" FOREIGN KEY ("upazila_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_assigned_community_id_communities_id_fk" FOREIGN KEY ("assigned_community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_assigned_coordinator_id_users_id_fk" FOREIGN KEY ("assigned_coordinator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_division_id_locations_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_service_areas" ADD CONSTRAINT "community_service_areas_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_service_areas" ADD CONSTRAINT "community_service_areas_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_blood_request_id_blood_requests_id_fk" FOREIGN KEY ("blood_request_id") REFERENCES "public"."blood_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_events" ADD CONSTRAINT "donation_events_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_events" ADD CONSTRAINT "donation_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_review_community_id_communities_id_fk" FOREIGN KEY ("review_community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_corrects_donation_id_donations_id_fk" FOREIGN KEY ("corrects_donation_id") REFERENCES "public"."donations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_consents" ADD CONSTRAINT "donor_consents_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_division_id_locations_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_upazila_id_locations_id_fk" FOREIGN KEY ("upazila_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_verification_community_id_communities_id_fk" FOREIGN KEY ("verification_community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_donor_a_donor_profiles_id_fk" FOREIGN KEY ("donor_a") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_donor_b_donor_profiles_id_fk" FOREIGN KEY ("donor_b") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_user_id_users_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_escalations" ADD CONSTRAINT "request_escalations_request_id_blood_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_escalations" ADD CONSTRAINT "request_escalations_from_community_id_communities_id_fk" FOREIGN KEY ("from_community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_escalations" ADD CONSTRAINT "request_escalations_to_community_id_communities_id_fk" FOREIGN KEY ("to_community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_escalations" ADD CONSTRAINT "request_escalations_escalated_by_user_id_users_id_fk" FOREIGN KEY ("escalated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_request_id_blood_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_request_id_blood_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."blood_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_donor_id_donor_profiles_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "availability_updates_donor_idx" ON "availability_updates" USING btree ("donor_id","confirmed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blood_requests_public_id_key" ON "blood_requests" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blood_requests_manage_token_key" ON "blood_requests" USING btree ("manage_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "blood_requests_open_dedupe" ON "blood_requests" USING btree ("dedupe_key") WHERE "blood_requests"."status" in ('open', 'in_progress');--> statement-breakpoint
CREATE INDEX "blood_requests_board_idx" ON "blood_requests" USING btree ("status","blood_group","district_id");--> statement-breakpoint
CREATE INDEX "blood_requests_community_idx" ON "blood_requests" USING btree ("assigned_community_id","status");--> statement-breakpoint
CREATE INDEX "blood_requests_needed_idx" ON "blood_requests" USING btree ("needed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_key" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_name_district_key" ON "communities" USING btree (lower("name"),"district_id");--> statement-breakpoint
CREATE INDEX "communities_status_idx" ON "communities" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "community_memberships_key" ON "community_memberships" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_memberships_user_idx" ON "community_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "service_areas_location_idx" ON "community_service_areas" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_requests_one_pending" ON "contact_requests" USING btree ("donor_id","requester_user_id") WHERE "contact_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "contact_requests_donor_idx" ON "contact_requests" USING btree ("donor_id","status");--> statement-breakpoint
CREATE INDEX "contact_requests_requester_idx" ON "contact_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_requests_one_pending" ON "deletion_requests" USING btree ("user_id") WHERE "deletion_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "donation_events_donation_idx" ON "donation_events" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_id","donated_on");--> statement-breakpoint
CREATE INDEX "donations_review_idx" ON "donations" USING btree ("review_community_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_no_duplicates" ON "donations" USING btree ("donor_id","donated_on","donation_type") WHERE "donations"."status" <> 'voided';--> statement-breakpoint
CREATE UNIQUE INDEX "donor_profiles_user_key" ON "donor_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donor_profiles_public_id_key" ON "donor_profiles" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "donor_profiles_search_idx" ON "donor_profiles" USING btree ("blood_group","district_id","status");--> statement-breakpoint
CREATE INDEX "donor_profiles_upazila_idx" ON "donor_profiles" USING btree ("upazila_id");--> statement-breakpoint
CREATE INDEX "donor_profiles_division_idx" ON "donor_profiles" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "donor_profiles_dup_idx" ON "donor_profiles" USING btree ("name_key","date_of_birth");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_reviews_pair_key" ON "duplicate_reviews" USING btree ("donor_a","donor_b");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_code_key" ON "locations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "locations_parent_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_level_idx" ON "locations" USING btree ("level");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "request_escalations_key" ON "request_escalations" USING btree ("request_id","to_community_id");--> statement-breakpoint
CREATE INDEX "request_escalations_to_idx" ON "request_escalations" USING btree ("to_community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "request_responses_key" ON "request_responses" USING btree ("request_id","donor_id");--> statement-breakpoint
CREATE INDEX "request_status_events_request_idx" ON "request_status_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email")) WHERE "users"."email" is not null;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verification_events_donor_idx" ON "verification_events" USING btree ("donor_id");