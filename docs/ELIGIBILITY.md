# Donation intervals and the "next donation" estimate

**Short version:** the app shows an *estimated* date after which a donor's minimum gap since
their last recorded donation has passed. It never says a donor *is eligible*. Eligibility is
decided on the day by the hospital or licensed blood bank after screening. Every screen that
shows the countdown says this in simple Bangla and English.

## How the estimate is calculated

Code: `src/server/domain/eligibility.ts` (pure, unit-tested in `tests/unit/eligibility.test.ts`).

1. Take the donor's donation records, ignoring records that are `voided` (withdrawn/corrected),
   `rejected` by a verifier, or dated in the future.
2. For each remaining record compute `donation date + interval[donation type]`.
3. The estimate is the **latest** of those dates. Blood services use different cross-type rules
   (for example whole blood followed by platelets), so taking the latest date is the
   conservative choice.
4. Days left = estimate − today, where *today* is the calendar date in Bangladesh
   (Asia/Dhaka, UTC+6). Dates are stored as plain calendar dates, so time zones cannot shift them.
5. States: `no_data` (no usable record), `waiting` (days left > 0), `interval_passed` (0 or less).
   `interval_passed` is shown as "the estimated waiting time is over — screening still decides",
   never as "eligible".

The estimate also says whether the record it is based on was verified or self-reported.

## Default intervals (configurable in Admin → Settings)

| Donation type | Default | Why |
|---|---|---|
| Whole blood | **120 days** | WHO guidance is cited as a minimum of 12 weeks (84 days) for men and 16 weeks (112 days) for women; UK JPAC guidance sets a 12-week minimum and describes 16 weeks as reasonable; India's NBTC uses 90 days for men and 120 days for women; common Bangladeshi practice is "every 4 months". The app does not collect sex (data minimisation), so it uses the most conservative of these, 120 days. |
| Double red cells | **240 days** | American Red Cross guidance uses twice the whole-blood interval for Power Red (56 → 112 days). The same 2× ratio is applied to the 120-day default. |
| Platelets (apheresis) | **14 days** | UK JPAC: minimum 2 weeks between plasma/platelet apheresis donations. American Red Cross allows 7 days; the longer one is used. |
| Plasma (apheresis) | **28 days** | American Red Cross uses 28 days; UK JPAC allows 2 weeks. The longer one is used. |

Limits enforced on the server: 7–365 days per type. Every settings change is audit-logged with
before/after values.

### Sources consulted (October 2026)

- UK Blood Transfusion Services (JPAC) — Whole Blood and Component Donor Selection Guidelines,
  "Frequency of donation": https://www.transfusionguidelines.org/dsg/wb/guidelines/fr002-frequency-of-donation
  and the Red Book chapter 3.6 (12-week minimum, 16 weeks reasonable; 2 weeks for apheresis).
- American Red Cross donation frequencies (whole blood 56 days, Power Red 112 days, platelets
  7 days, plasma 28 days), as summarised by Abbott:
  https://www.abbott.com/corpnewsroom/diagnostics-testing/how-often-can-I-donate-blood.html
  (the Red Cross eligibility page itself refused automated access).
- WHO 12/16-week figures were found only as citations in secondary sources; the 2012 WHO
  publication "Blood donor selection: guidelines on assessing donor suitability for blood
  donation" should be checked directly.
- WHO Bangladesh, "Bangladesh is still to meet the demand of safe blood supply" (2017):
  https://www.who.int/bangladesh/news/detail/14-06-2017-bangladesh-is-still-to-meet-the-demand-of-safe-blood-supply

**Before launch:** confirm the intervals with the National Safe Blood Transfusion Programme
(DGHS) or a transfusion medicine specialist in Bangladesh, and adjust them in Admin → Settings.
No official Bangladeshi interval could be confirmed online during development.

## What the app does NOT do

- It does not apply medical deferral rules (illness, medicines, travel, pregnancy, tattoos,
  haemoglobin, weight). These are judged at screening.
- It does not infer availability from the estimate. Availability is only what the donor says
  (see `src/server/domain/availability.ts`).
- The minimum registration age (18 by default) is a consent rule for an adult platform, not a
  medical rule.
