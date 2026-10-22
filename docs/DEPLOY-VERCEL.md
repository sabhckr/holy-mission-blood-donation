# Deploying to Vercel + Supabase (free tiers)

The site runs as a Next.js app on Vercel with a Supabase PostgreSQL database in Singapore
(closest Supabase region to Bangladesh). Vercel needs two settings: `DATABASE_URL` and `DATABASE_PASSWORD`.

## 1. Database (Supabase)

1. In Supabase, create a new project (free plan), region **Southeast Asia (Singapore)**.
   Generate a strong database password and keep it in your password manager.
2. Turn **off** "Enable Data API" when creating the project: the app connects directly and the
   public REST API would otherwise expose its tables.
3. Open the project → **Connect** → **Direct** → **Session pooler** (the IPv4 "shared pooler")
   and copy the URI as shown, keeping the `[YOUR-PASSWORD]` placeholder:
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`.
   Supabase's "transaction pooler" entry may point at an IPv6-only host that Vercel cannot reach.

Put the raw password in `DATABASE_PASSWORD` (see below): no URL-encoding needed. On Vercel the
app automatically uses the same shared pooler in transaction mode (port 6543) for web requests,
because session mode allows only 15 clients; migrations and seeding use session mode (5432).
Set `MIGRATION_DATABASE_URL` only if you want migrations to use a different connection.

## 2. Web app (Vercel)

1. Import the GitHub repository in Vercel (Add New → Project). Framework: Next.js (detected).
2. Add two environment variables: `DATABASE_URL` = the URI from step 1 (with the placeholder),
   and `DATABASE_PASSWORD` (type **Secret**) = the database password.
3. Deploy. The build runs `npm run vercel-build`, which applies migrations, seeds the location
   list (idempotent) and then builds the app. Functions run in Singapore (`sin1`, vercel.json).

Optional variables:

| Variable | Why |
|---|---|
| `DATABASE_PASSWORD` | The raw database password. Use it to keep `DATABASE_URL` with the `[YOUR-PASSWORD]` placeholder as Supabase shows it: no URL-encoding needed. |
| `APP_SECRET` | 32+ random characters for hashing IP addresses. Without it, a key is derived from the database connection details including the password (changing the DB password then resets rate-limit counters). |
| `CRON_SECRET` | Enables the daily maintenance job (`/api/cron/maintenance`, 03:00 Bangladesh time). Not required: overdue requests are already shown as expired. |
| `APP_BASE_URL` | Only for a custom domain; otherwise the Vercel production domain is used. |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE` | Official contact details for `/contact`. |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET` | SMS/email relay (see README). |

## 3. First administrator

From the project folder on your own computer. The first line asks for the **database** password
without showing it; the script then asks for the new **admin** password the same way.

```bash
read -s DATABASE_PASSWORD && export DATABASE_PASSWORD && DATABASE_URL='<the URI from step 1>' ADMIN_PHONE=01XXXXXXXXX ADMIN_NAME="Your Name" npm run admin:create
```

## Notes

- Vercel's Hobby plan is for non-commercial use; a volunteer blood donation service fits that.
- Supabase pauses free projects after a week without any activity; the site wakes it again on
  the next request, which can take a little while.
- Every push to `main` redeploys automatically and applies new migrations first.
