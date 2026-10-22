-- Store Bangla text in Unicode NFC so that "য়" typed as U+09AF U+09BC and the precomposed
-- U+09DF compare equal (search, sorting, duplicate detection).
UPDATE "locations" SET "name_bn" = normalize("name_bn", NFC), "name_en" = normalize("name_en", NFC);
--> statement-breakpoint
UPDATE "donor_profiles" SET "full_name" = normalize("full_name", NFC), "locality" = normalize("locality", NFC);
--> statement-breakpoint
UPDATE "communities" SET "name" = normalize("name", NFC);
