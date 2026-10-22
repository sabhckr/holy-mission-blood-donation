ALTER TABLE "communities" ADD COLUMN "representative_name" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "representative_role" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "representative_phone" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "verification_info" text;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_verification_info_len" CHECK ("communities"."verification_info" is null or char_length("communities"."verification_info") <= 1000);