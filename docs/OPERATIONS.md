# Operations: backups, recovery and safe deploys

## Deploys

- Every push to `main` deploys to production on Vercel. The build runs database migrations
  (`scripts/migrate.ts`) and the idempotent location/operating-area seed **against the production
  database** before building, so review migrations before pushing.
- `DATABASE_URL` is currently set for **Production and Preview** in Vercel, while
  `DATABASE_PASSWORD` is Production only. A preview deployment (any other branch or a pull request)
  would try to migrate the production database and fail on the password. Recommended: restrict
  `DATABASE_URL` to Production, or give previews their own database.
- Migration `0002_review_roles_operating_areas` adds registration review, the moderator role,
  operating areas, availability sources and organisation affiliation. It marks donors who existed
  before it as `approved` so they stay visible, and seeds Lakshmipur as the only active operating
  area (the seed never re-activates an area an admin switched off).
- Migration `0003_organisation_representative` adds four nullable columns to `communities`
  (representative name, role, mobile number, verification information). Existing organisations
  keep working; their leaders are asked for a representative the next time they save the
  organisation's settings, because the form now requires a name and a valid mobile number.
- Migration `0004_auto_approve_donors` approves donor registrations that were still waiting, for
  addresses in Lakshmipur only (rejected ones and records outside Lakshmipur are untouched). The
  rows get the note "Approved automatically: donors no longer need approval", and the migration
  file shows the one statement that reverses it.

- Migration `0005_phone_can_be_public` drops the database rule that kept phone numbers from being
  `public`, so donors can let anyone call them without signing in. Existing choices are not
  changed. It also stores the time it ran in `settings` (`public_phone_since`): donors whose
  choice is older are asked once on their dashboard, and answering either way ends the question.
  To undo: `ALTER TABLE donor_consents ADD CONSTRAINT donor_consents_phone_not_public
  CHECK (phone_visibility <> 'public')` after moving any `public` rows back.
- Migration `0006_everything_public` sets every donor's name, phone, area, donation history and
  organisation visibility to `public` and makes `public` the default; the forms no longer offer a
  choice. Earlier choices are overwritten, so they cannot be restored from the database. It
  replaces `public_phone_since` with `public_details_since` in `settings`: donors who agreed
  before then are told once on their dashboard, and can leave the donor list from the privacy page.

## Making someone an admin on the live site

No password is needed:

1. The person signs up (or already has an account) on the live site with their mobile number.
2. In Vercel → Project → Settings → Environment Variables, add `ADMIN_PHONE` for Production with
   that number (several numbers can be separated by commas).
3. Redeploy (or push). The build's seed step makes the existing account an admin and writes an
   audit entry; the build log shows only counts, never the number. It never creates accounts and
   never removes anyone's role. Remove the variable afterwards if you like; it does nothing more.

Alternatively, from a computer with the production connection string: `ADMIN_PHONE=01XXXXXXXXX npm run admin:create`.

## Backups

The free Supabase plan has limited backup options; check the project's **Database → Backups**
page for what your plan includes. Independently of the plan, keep your own copies:

```bash
pg_dump "$BACKUP_DATABASE_URL" --format=custom --no-owner --file="holy-mission-$(date +%F).dump"
```

Use the session-pooler or direct connection string for `BACKUP_DATABASE_URL`, run it on a
schedule from a trusted machine, and store the files encrypted (they contain personal data:
names, phone numbers, dates of birth). Keep a short retention period and delete old copies.

## Restore (practice it before you need it)

```bash
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" holy-mission-YYYY-MM-DD.dump
```

Restore into a separate test project first, check it, then point the app at it if needed.

## Routine

- `npm run maintenance` (or the Vercel cron with `CRON_SECRET`) expires old requests, sends queued
  notifications and removes expired sessions.
- Review Admin → Reports, Duplicates and pending registrations regularly.
- Rotate the database password if it is ever shared; update `DATABASE_PASSWORD` in Vercel and
  redeploy.
