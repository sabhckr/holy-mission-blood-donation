ALTER TABLE "donor_consents" DROP CONSTRAINT "donor_consents_phone_not_public";
--> statement-breakpoint
-- When "everyone, no sign-in" became a phone choice (the moment this deploy ran). Donors whose
-- choice is older are asked once on their dashboard; nothing about their choice changes here.
INSERT INTO "settings" ("key", "value") VALUES ('public_phone_since', to_jsonb(now())) ON CONFLICT ("key") DO NOTHING;
