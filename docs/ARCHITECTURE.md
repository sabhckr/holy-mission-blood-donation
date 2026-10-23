# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 16 (App Router, React Server Components, Server Actions), TypeScript | Pages render on the server, so cheap Android phones receive HTML with very little JavaScript. Forms are Server Actions that work before (or without) JavaScript. |
| Database | PostgreSQL (17 locally) with Drizzle ORM + `postgres` driver | Typed queries, plain SQL migrations in `drizzle/`, real constraints and partial unique indexes. |
| Validation | Zod 4 | Server-side schemas; errors are translation keys, not English strings. |
| Styling | One hand-written stylesheet (`src/app/globals.css`) | No CSS framework or component runtime shipped to phones. Native, accessible HTML controls (`<select>`, `<details>`, radio/checkbox) instead of a JS component library. |
| Icons | lucide-react, rendered on the server | SVG in the HTML, no icon font. |
| Fonts | Noto Sans Bengali via `next/font` (self-hosted at build time) | Correct Bangla conjuncts; no request to Google at runtime. |
| Tests | Vitest (unit + integration on a real Postgres), Playwright (installed Chrome) | |

No Redis, queues or third-party services are required. Rate limits and sessions live in
Postgres so several app instances can run behind a load balancer.

## Layout

```
src/
  proxy.ts                 per-request CSP nonce + x-url header (Next 16 "proxy" = old middleware)
  app/                     routes (server components) and colocated server actions
    _actions/              shared actions (auth, reveal number, contact request, report)
    account/ manage/ admin/ communities/ requests/ donors/ ...
  components/              UI; client components only where interaction needs it
    form/                  ActionForm (useActionState), fields, LocationPicker
  i18n/
    config.ts define.ts    locales, typed defineMessages()
    messages/*.ts          one namespace per area, Bangla + English side by side
    server.ts format.ts    getI18n() (cookie → messages + formatters), Bangla digits/dates
  server/
    db/schema.ts           the whole data model
    policy.ts              permission rules (pure)
    domain/                pure logic: dates, eligibility, availability, phone, donor projection
    services/              all reads/writes; every function takes the acting user and checks permissions
    security/              rate limiting, request metadata, same-origin check
    notify/                notification provider boundary (webhook)
    actions.ts             FormState helpers (translate errors, keep values)
    validation.ts          zod field helpers, form parsing
scripts/                   create-db, migrate, seed, create-admin, maintenance, e2e-prepare
drizzle/                   generated SQL migrations
data/bd-locations.json     8 divisions, 64 districts, 494 upazilas (MIT, nuhil/bangladesh-geocode)
tests/unit|integration|e2e
docs/                      this folder
```

## Request flow

1. `proxy.ts` adds a CSP nonce and the current URL header.
2. A page (server component) calls `getI18n()` (language from the `hm_lang` cookie, Bangla by
   default) and `getActor()` (session cookie → `sessions` table → user + donor id).
3. Pages call service functions for data. Services decide what the viewer may see — for example
   `projectDonor()` turns a donor row into exactly the fields the viewer is allowed to see.
4. Forms post to Server Actions. An action parses `FormData` with Zod, applies a rate limit,
   calls a service with the actor and request metadata, and returns a `FormState` whose messages
   are already translated. Next.js checks the `Origin` header on every Server Action (CSRF).
5. Services write inside transactions and add an audit log entry for anything security-relevant.

## Data model (main tables)

- `users` (accounts; phone is the login), `sessions` (hashed tokens), `password_reset_tokens`.
- `locations` (division → district → upazila, admin-editable).
- `donor_profiles` (one per user, optional), `donor_consents` (listing and contact consent; per-category visibility, always `public` since migration 0006),
  `availability_updates` (history; current state is denormalised on the profile),
  `verification_events`.
- `donations` + `donation_events` (append-only trail; corrections void and re-create).
- `communities`, `community_service_areas`, `community_memberships` (role + status).
- `blood_requests`, `request_status_events`, `request_escalations`, `request_responses`.
- `contact_requests` (consent-based contact).
- `notifications`, `notification_deliveries` (external delivery attempts, honest status).
- `reports` (abuse / wrong information), `duplicate_reviews`, `deletion_requests`.
- `audit_logs` (ids and enum values only), `settings` (JSON values), `rate_limits`.

Key constraints: one live donation per donor/date/type (partial unique index), one open request
per phone/group/district/day, one pending contact request per pair,
availability rows must have an expiry exactly when `available`, request units 1–20,
location parent/level consistency.

## Language

`defineMessages({ bn, en })` makes TypeScript reject an English dictionary that is missing a key
(or has an extra one). Unit tests also check parity, non-empty text, that English has no Bangla
except the slogan, and scan every `.tsx` file for hard-coded text. The language switch is a plain
link (`/lang?to=en&next=…`), stored in a one-year cookie and on the user's account.

## Notifications

In-app notifications always work. External delivery goes through `src/server/notify/providers.ts`:
a signed JSON webhook (`NOTIFY_WEBHOOK_URL` + `NOTIFY_WEBHOOK_SECRET`) that you point at an SMS
or email relay. A delivery is recorded as `sent` only on an HTTP 2xx from the relay; without a
provider the delivery row says `not_configured`, and the UI says so.

## Jobs

`npm run maintenance` (cron every 10–15 minutes) expires overdue requests and contact requests,
sends queued notifications, and removes expired sessions and old rate-limit rows. Pages also
treat overdue requests as expired when they read them, so correctness does not depend on cron.
