# Separate concepts, separate fields

Holy Mission keeps several ideas apart on purpose. None of them implies another.

| Concept | Where it lives | Values | Who changes it |
|---|---|---|---|
| **Service area (fixed policy)** | `src/server/services/service-area.ts` (Lakshmipur, location code `dist-7`) | Lakshmipur district and its five upazilas only | Nobody in the app; it is a code-level rule enforced by every service and public query. |
| **Holy Mission's operating areas** | `operating_areas` (linked to `locations`) | active / inactive per area, inside Lakshmipur only. Initially **Lakshmipur district**. | Admins only (`operating_areas.manage`), with a reason; audit-logged. |
| **Donor's area** | `donor_profiles.division_id / district_id / upazila_id / locality` | Lakshmipur district (upazila optional) | The donor; staff can correct it with a reason. Older records outside Lakshmipur are kept, hidden from the public, cannot be approved, and are listed for staff at `/admin/donors?area=outside`. |
| **Organisation's area** | `communities.division_id / district_id` + `community_service_areas` | head office in Lakshmipur; serves Lakshmipur or its upazilas | The organisation's leader. Older organisations based elsewhere are hidden from the directory and cannot be approved. |
| **Blood request location** | `blood_requests.division_id / district_id / upazila_id` | Lakshmipur district | The requester. Older requests elsewhere are hidden from the public board; their private link still works. |
| **Organisation status** | `communities.status` | pending → approved / rejected; approved ↔ suspended | Admins (`communities.review`). "Approved" is the only state shown as reviewed/verified. |
| **Organisation affiliation** | `communities.affiliation` | `independent` (default) / `holy_mission` | Admins only, with a reason, and only for approved organisations. Registering never makes an organisation part of Holy Mission. |
| **Donor registration status** | `donor_profiles.registration_status` | pending → approved / rejected (a corrected rejected profile returns to pending) | Staff (`donors.review`); never their own record. |
| **Donor listing status** | `donor_profiles.status` | active, paused (by the donor), restricted (deactivated by staff), removed (by staff, restorable) | Donor pauses/resumes; staff deactivate/remove/restore with a reason. Donors cannot undo staff decisions. |
| **Search consent** | `donor_consents.listed_in_search` (+ per-field visibility) | yes / no | The donor. |
| **Donor availability** | `donor_profiles.availability_status / availability_expires_at / availability_source` and history in `availability_updates` | available (until the confirmation expires, default 30 days), unavailable, unknown | The donor; staff may override with a reason (`donors.availability`). Overrides are stored with source `staff`, the actor, the previous value and the reason, shown publicly as "updated by an administrator", and the donor is notified. |
| **Donor profile verification** | `donor_profiles.verification_status` | unverified / pending / verified / rejected | Coordinators of the donor's community or staff (`verifications.review`), never the donor. |
| **Medical eligibility** | nowhere | — | Decided only by the hospital or blood bank at screening. The app shows an *estimated* next donation date and says so. |

## What the public sees

Public donor search returns a donor only when **all** of these hold: the donor consented to be
listed, staff approved the registration, the listing is active, the account is active, and the
donor is currently marked available. The same "publicly listed" rule (minus availability) governs
public profiles, phone-number reveals, contact requests and offers on blood requests
(`publiclyListedConditions()` / `isPubliclyListed()` in `src/server/services/donors.ts`).

Donors whose availability is unknown or "not now" are not shown in public search. Approved
community coordinators can still find consenting donors in their service area through the
community donor finder, which shows availability honestly.
