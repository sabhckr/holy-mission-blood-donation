# Security and privacy measures

| Area | What is in place | Where |
|---|---|---|
| Passwords | scrypt (N=2¹⁵, r=8, p=1, 64-byte key, random salt), parameters stored per hash; weak/common passwords and passwords containing the phone number refused; length 8–128 | `server/auth/password.ts`, `validation.ts` |
| Sign-in | Same error for unknown numbers and wrong passwords; a real hash is computed for unknown numbers (timing); 5 failures → 15-minute lock; per-IP and per-number rate limits | `services/accounts.ts`, `security/rate-limit.ts` |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production); only the SHA-256 is stored; 30-day expiry; password change/reset revokes other sessions; users can list and revoke sessions; suspended accounts lose sessions immediately | `services/accounts.ts`, `auth/current.ts` |
| CSRF | Server Actions: Next.js Origin/Host check. Route handlers that change state (`/signout`, admin export) check Origin/Referer. Cookies are `SameSite=Lax`. Language switch only redirects to same-site paths. | `security/origin.ts`, `auth/current.ts#safeNextPath` |
| Headers | Per-request nonce CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (no camera/mic/geolocation), COOP, HSTS when secure, no `X-Powered-By` | `proxy.ts`, `next.config.ts` |
| CORS | No CORS headers are sent, so browsers block cross-origin reads of every route. | — |
| Input | Zod schemas on every action; enums for every choice; length limits mirrored by DB CHECKs; free-text notes refuse phone numbers; CSV export neutralises spreadsheet formulas | `validation.ts`, `services/admin.ts` |
| Injection | Drizzle query builder / parameterised `sql` templates only; `LIKE` patterns escaped | services |
| Output encoding | React escapes all text; no `dangerouslySetInnerHTML` | — |
| Mass assignment | Services accept explicit typed inputs and copy named fields; role, verification, status and counts are never taken from forms | services |
| Authorization | Central rules in `policy.ts`; every service re-checks; other people's records answer *not found* (IDOR); admin pages 404 for non-admins | `policy.ts`, `docs/PERMISSIONS.md` |
| Rate limits | Postgres fixed windows: sign-in, registration, number reveals, contact requests, blood requests, reports, community registration, search, exports, password resets | `security/rate-limit.ts` |
| Duplicates | Unique phone/email; one live donation per day/type; one open request per phone/group/district/day; one pending contact request per pair; duplicate-donor review queue for admins | schema, `services/admin.ts` |
| Audit | Security-relevant actions logged with actor, role, target and non-sensitive metadata; keys that look like phone/password/token are dropped automatically; IPs stored only as keyed hashes | `services/audit.ts` |
| Exports | Admin only, password re-entry, rate limited, logged; no phone numbers, dates of birth or localities in any export | `services/admin.ts#exportData` |

## Privacy by design

- No live location tracking, no GPS, no full addresses. Donors pick division/district/upazila and
  an optional short area name.
- Per-category consent (name, phone, area, donation history, communities, search listing,
  coordinator contact, contact requests) with the policy version and time recorded; changes are
  audit-logged.
- Patient data is minimised: blood group, quantity, hospital, time, and an optional 300-character
  note that refuses phone numbers. No diagnosis, no identity documents.
- Deactivation hides everything immediately. A deletion request hides the donor immediately; when
  an admin processes it, the donor profile, donations, availability, consents, memberships,
  notifications, sessions and contact requests are deleted, the requester's name/number are
  removed from their blood requests, and the account row becomes an anonymous tombstone (so audit
  history stays consistent without personal data).
- Retention: expired sessions and rate-limit windows are deleted by `npm run maintenance`.

## Known gaps (need infrastructure or decisions)

- **Phone ownership is not verified** (no SMS provider). Someone could register another person's
  number. Mitigations: reports, admin review, verification by communities. Add OTP once an SMS
  gateway is chosen.
- **Account enumeration on sign-up**: registration has to say when a number is already used.
  It is rate limited (5/hour/IP). A fully enumeration-proof flow needs OTP.
- **Password reset** is admin-assisted (one-time link, 24 h) until SMS/email exists.
- `X-Forwarded-For` is trusted for rate limiting by default; set `TRUST_PROXY=false` when not
  behind a proxy that overwrites it.
- No automated malware/abuse scanning, no 2FA for admins yet (recommended before launch).
