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
