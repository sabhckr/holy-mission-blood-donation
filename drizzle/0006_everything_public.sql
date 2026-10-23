ALTER TABLE "donor_consents" ALTER COLUMN "name_visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "donor_consents" ALTER COLUMN "phone_visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "donor_consents" ALTER COLUMN "locality_visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "donor_consents" ALTER COLUMN "donation_history_visibility" SET DEFAULT 'public';--> statement-breakpoint
-- Everything a donor shares is now shown to everyone, signed in or not (the site owner's decision):
-- every donor's choices become "everyone". Donors can still leave the donor list as a whole.
UPDATE "donor_consents" SET "name_visibility" = 'public', "phone_visibility" = 'public', "locality_visibility" = 'public', "donation_history_visibility" = 'public', "community_visibility" = 'public', "updated_at" = now();--> statement-breakpoint
-- When this happened, so donors who agreed earlier are told once on their dashboard. It replaces
-- the "show your number to everyone?" question from migration 0005.
DELETE FROM "settings" WHERE "key" = 'public_phone_since';--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES ('public_details_since', to_jsonb(now())) ON CONFLICT ("key") DO NOTHING;
