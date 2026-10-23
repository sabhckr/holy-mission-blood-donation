# Lakshmipur Blood Donation

**রক্ত লাইগলে রক্ত আছে, এত ডরানোর কী আছে?**
*(Need blood? There is blood. No need to be afraid.)*

A Bangla-first, privacy-respecting community blood donor network for Bangladesh. Donors register
and decide exactly who may see each piece of their information; people who need blood search by
blood group and area, post requests, and get help from local blood donation organisations.

This is a community coordination tool. It is **not** a hospital or blood bank, and it never
decides whether someone is medically eligible to donate.

**Lakshmipur only.** Lakshmipur Blood Donation works in **Lakshmipur district** only. Donor
registration, donor search, blood requests and organisations are limited to Lakshmipur and its
five upazilas, and the services enforce this on the server (`src/server/services/service-area.ts`),
not just in the forms. Records saved before this rule are kept but hidden from the public and
flagged for staff; `npm run report:service-area` counts them (read-only). Registering never makes
an organisation a Lakshmipur Blood Donation branch. See [docs/STATUSES.md](docs/STATUSES.md)
for how operating area, donor area, registration review, listing, availability, verification and
medical eligibility are kept apart.

## What is included

- **Public site** – a simple home (slogan, Lakshmipur notice, donor search by group and upazila,
  the three main actions, privacy and safety notes); donor search with all eight blood groups,
  upazila and area filters, donor-confirmed availability,
  verification filter, sorting and pagination; privacy-safe donor profiles; community directory
  and pages; blood request board; help, contact, privacy and terms pages.
- **No-donor fallback** – when a search finds nobody: counts in the upazila and the whole of
  Lakshmipur with one-click wider searches, approved communities serving the area, a
  prefilled blood request, and hospital/blood bank advice.
- **Donors** – registration with explicit per-category consent, profile editing (identity
  changes reset verification), privacy controls, availability confirmation that expires,
  donation history (self-reported vs verified, corrections keep history), an estimated next
  donation date with a clear medical disclaimer, contact requests, notifications, sessions,
  deactivation and deletion requests.
- **Consent-based contact** – numbers are never shown to visitors; signed-in users reveal a
  number only when the donor allows it (rate limited, logged); otherwise they send a contact
  request and numbers are exchanged only if the donor accepts.
- **Communities** – registration and admin approval, service areas, membership applications,
  leader/coordinator/member roles, verification queues for donation records and donor profiles,
  a donor finder limited to consenting donors in the service area, request queues, taking and
  assigning requests, escalation to other communities, and reports that separate verified from
  self-reported data.
- **Blood requests (booking)** – blood group, units, location, hospital, date and time, urgency,
  contact preference, private management link for anonymous requesters, donor offers (never treated
  as agreement until confirmed), status history, expiry, duplicate protection. The needed date must
  be **today through 15 days ahead, inclusive, in Bangladesh time** (`src/server/domain/booking.ts`),
  checked on the server and in the form. After saving, the requester sees the real reference number,
  the saved details and an honest count of donors who have said they can give (none of whom has
  agreed yet). A donor is refused for a date their own donation records put before their next
  estimated donation, and cannot be confirmed on two open requests at once (the donor row is locked
  while confirming); confirmed and declined donors are notified. An unfinished request form survives
  a language switch (kept in the browser tab only, cleared on submit).
- **No approval for donors** – a new donor is in the donor list as soon as they register (if they
  chose to be listed and said they can donate now). Only organisations are reviewed by an admin.
  Staff can still close a donor's listing or reject a registration afterwards; a rejected donor
  who corrects their details goes back to staff for a decision.
- **Staff roles** – admins and moderators (donor work only), each page and action guarded by a
  named permission; every staff change records who, when, the previous value and the reason.
- **Administration** – overview figures, users (suspend, roles with re-authentication, sessions,
  reset links, donor restriction), organisation approval/suspension, verification queues,
  request oversight, abuse/wrong-information reports, duplicate review, locations, searchable
  audit log, settings (availability expiry, donation intervals…), access review, exports,
  deletion processing.
- **Bangla and English** everywhere via typed dictionaries (`src/i18n/messages/*`), with a
  `বাংলা | English` switch remembered across visits.

See `docs/` for the [architecture](docs/ARCHITECTURE.md), [permission matrix](docs/PERMISSIONS.md),
[donation intervals and sources](docs/ELIGIBILITY.md), [security & privacy](docs/SECURITY-PRIVACY.md),
[separate statuses](docs/STATUSES.md), [deploying](docs/DEPLOY-VERCEL.md) and [operations & backups](docs/OPERATIONS.md).

## Run it locally

Requirements: Node.js 20.9+ (tested on 26), PostgreSQL 14+ (tested on 17), Google Chrome for the
end-to-end tests.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local`: set `DATABASE_URL` and a random `APP_SECRET` (`openssl rand -hex 32`).

```bash
npm run db:setup
```

This creates the database, applies migrations and seeds 8 divisions, 64 districts and 494
upazilas. No donors, organisations or requests are seeded — the site starts empty.

Create the first administrator (use a real number you control and a strong password):

```bash
ADMIN_PHONE=01XXXXXXXXX ADMIN_NAME="Your Name" ADMIN_PASSWORD='a-long-password' npm run admin:create
```

```bash
npm run dev
```

Open http://localhost:3000.

On macOS with Homebrew Postgres, if the server will not start, start it with
`LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@17 start`.

### Scheduled maintenance

Run every 10–15 minutes in production (cron, systemd timer, etc.):

```bash
npm run maintenance
```

## Checks

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

Unit + integration tests. Integration tests create and use `holy_mission_test`
(override with `TEST_DATABASE_URL`).

```bash
npm run build
```

```bash
npm run test:e2e
```

End-to-end tests start `next start` on port 3200 against a throwaway `holy_mission_e2e` database
(recreated on every run) and use the installed Google Chrome. Run `npm run build` first.

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_SECRET` | 32+ random characters; keys the IP hashes (required in production) |
| `APP_BASE_URL` | Public URL, used in links |
| `COOKIE_SECURE` | `true` behind HTTPS (default in production) |
| `TRUST_PROXY` | `false` if not behind a proxy that sets `X-Forwarded-For` |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | Extra hosts allowed to post forms (reverse proxies) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Same value on every instance when running several |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET`, `NOTIFY_WEBHOOK_CHANNEL` | Optional SMS/email relay (see below) |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE` | Official contact details for `/contact` (none are invented) |

### Not configured yet (needs your decision or credentials)

- **SMS / email sending.** No provider is bundled. In-app notifications work. To send SMS or
  email, run a relay that accepts `POST {channel, to, text}` with an
  `X-HM-Signature: hex(HMAC-SHA256(body, NOTIFY_WEBHOOK_SECRET))` header and forwards it to your
  provider; the app records `sent` only when the relay answers 2xx.
- **Phone verification (OTP)** and self-service password reset depend on SMS. Until then,
  administrators issue one-time reset links.
- **Official contact details** for the contact page.
- **Medical review** of the default donation intervals (see `docs/ELIGIBILITY.md`).

## Deploying

The live setup is Vercel + Supabase (free tiers): see [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md).

Any other Node.js host with PostgreSQL works: `npm ci && npm run build`, run migrations with
`npm run db:migrate`, start with `npm start`, put it behind HTTPS, set the variables above and
schedule `npm run maintenance`. Nothing in this repository deploys anything by itself.

## Credits

Location data: [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode) (MIT,
see `data/bd-locations.LICENSE`). Administrators can correct names and add areas in Admin →
Locations.
