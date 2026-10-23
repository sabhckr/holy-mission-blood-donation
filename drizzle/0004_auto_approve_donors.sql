-- Donors no longer need staff approval to appear in the donor list (only organisations are
-- reviewed). Registrations still waiting are approved now, for addresses in Lakshmipur only;
-- rejected registrations, staff decisions and records outside Lakshmipur are left as they are.
-- The note marks these rows, so the change can be found (and reversed) later if ever needed:
--   UPDATE donor_profiles SET registration_status = 'pending', registration_reviewed_at = NULL, registration_note = NULL
--   WHERE registration_note = 'Approved automatically: donors no longer need approval';
UPDATE "donor_profiles"
SET "registration_status" = 'approved',
    "registration_reviewed_at" = now(),
    "registration_note" = 'Approved automatically: donors no longer need approval'
WHERE "registration_status" = 'pending'
  AND "district_id" = (SELECT "id" FROM "locations" WHERE "code" = 'dist-7');
