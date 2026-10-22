# Deploying to Vercel + Supabase (free tiers)

The site runs as a Next.js app on Vercel with a Supabase PostgreSQL database in Singapore
(closest Supabase region to Bangladesh). The only setting Vercel needs is `DATABASE_URL`.

## 1. Database (Supabase)

1. In Supabase, create a new project (free plan), region **Southeast Asia (Singapore)**.
   Generate a strong database password and keep it in your password manager.
2. Open the project → **Connect** → **Transaction pooler** and copy the URI. It looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`.
   Replace `[YOUR-PASSWORD]` with the password. If the password contains special characters
   (`@ : / ? # %`), URL-encode them.

The app uses the transaction pooler (port 6543, prepared statements off) for web requests and
automatically switches to the session pooler (port 5432) for migrations and seeding. Set
`MIGRATION_DATABASE_URL` only if you want migrations to use a different connection.

## 2. Web app (Vercel)

1. Import the GitHub repository in Vercel (Add New → Project). Framework: Next.js (detected).
2. Add one environment variable: `DATABASE_URL` = the URI from step 1.
3. Deploy. The build runs `npm run vercel-build`, which applies migrations, seeds the location
   list (idempotent) and then builds the app. Functions run in Singapore (`sin1`, vercel.json).

Optional variables:

| Variable | Why |
|---|---|
| `DATABASE_PASSWORD` | The raw database password. Use it to keep `DATABASE_URL` with the `[YOUR-PASSWORD]` placeholder as Supabase shows it: no URL-encoding needed. |
| `APP_SECRET` | 32+ random characters for hashing IP addresses. Without it, a key is derived from `DATABASE_URL` (changing the DB password then resets rate-limit counters). |
| `CRON_SECRET` | Enables the daily maintenance job (`/api/cron/maintenance`, 03:00 Bangladesh time). Not required: overdue requests are already shown as expired. |
| `APP_BASE_URL` | Only for a custom domain; otherwise the Vercel production domain is used. |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE` | Official contact details for `/contact`. |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET` | SMS/email relay (see README). |

## 3. First administrator

From your own computer (the password is asked for without being shown):

```bash
DATABASE_URL='<the same URI>' ADMIN_PHONE=01XXXXXXXXX ADMIN_NAME="Your Name" npm run admin:create
```

## Notes

- Vercel's Hobby plan is for non-commercial use; a volunteer blood donation service fits that.
- Supabase pauses free projects after a week without any activity; the site wakes it again on
  the next request, which can take a little while.
- Every push to `main` redeploys automatically and applies new migrations first.
