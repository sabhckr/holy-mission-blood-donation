# Permission matrix

All rules are enforced on the server. The UI hides controls, but every service function in
`src/server/services/*` re-checks the actor before reading or writing data. The rules live in
`src/server/policy.ts` and are tested in `tests/unit/policy.test.ts` and the integration tests.

Roles:

- **Visitor** – not signed in.
- **User** – any signed-in account (may or may not have a donor profile).
- **Donor** – a user with a donor profile, acting on their own data.
- **Member / Coordinator / Leader** – active membership in an organisation (community).
  Capabilities only apply while the community is **approved**; a pending community's leader may
  only edit its profile; suspended or rejected communities lose all powers.
- **Admin** – platform administrator (`users.role = 'admin'`).

Suspended or deleted accounts have no session at all. Deactivated accounts can only sign in to
reactivate.

## Donor information

Each donor chooses a visibility for every category: `public`, `signed_in`, `coordinators`, `private`.

| Viewer \ visibility | public | signed_in | coordinators | private |
|---|---|---|---|---|
| Visitor | ✓ | – | – | – |
| User (incl. coordinators on public pages) | ✓ | ✓ | – | – |
| Coordinator inside their donor finder · Admin | ✓ | ✓ | ✓ | – |
| The donor | ✓ | ✓ | ✓ | ✓ |

Extra rules:

- **Phone numbers** can never be `public` (form, service and a database CHECK constraint).
  Numbers are never part of a page; a signed-in viewer must press "Show number", which is
  rate-limited (20/day) and audit-logged without the number.
- **Search** lists only donors who opted in (`listed_in_search`), with active profiles and
  accounts. A locality filter only matches localities visible to that viewer.
- **Coordinator donor finder** lists only donors who opted in to coordinator contact *and* live
  inside the community's service area. Membership is not required, and several communities can
  reach the same donor.
- **Date of birth** is never shown to anyone but the donor; coordinators see age only.
- **Contact requests**: the donor sees the requester's name and message; numbers are exchanged
  only after the donor accepts.

## Actions

| Action | Visitor | User | Donor (own) | Member | Coordinator | Leader | Admin |
|---|---|---|---|---|---|---|---|
| Search donors, view public profiles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reveal a donor's number (consent-based, logged) | – | ✓ | own | ✓ | ✓ in finder | ✓ in finder | ✓ |
| Send a contact request | – | ✓ | – (not to self) | ✓ | ✓ | ✓ | ✓ |
| Create a blood request | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage a blood request | private link | if creator | if creator | – | assigned / escalated community | same | ✓ |
| Requester: close (fulfilled / cancelled) | ✓ link | ✓ creator | | | | | |
| Mark in progress, assign, escalate | – | – | – | – | ✓ | ✓ | ✓ |
| Take an unassigned request | – | – | – | – | in service area | in service area | ✓ |
| Offer to donate on a request | – | – | ✓ | | | | |
| Confirm a donor's offer | – | creator/link | | | ✓ | ✓ | ✓ |
| Edit own profile, consents, availability | – | – | ✓ | | | | |
| Add / correct / withdraw own donation records | – | – | ✓ | | | | ✓ withdraw |
| Verify / reject a donation record | – | – | ✗ never own | – | ✓ if submitted to their community and donor still an active member | same | ✓ (not own) |
| Verify a donor profile | – | – | ✗ never own | – | same as above | same | ✓ (not own) |
| Register an organisation | – | ✓ | ✓ | | | | |
| Approve / reject / suspend organisations | – | – | – | – | – | – | ✓ |
| Approve/reject member applications, remove members | – | – | – | – | ✓ (members only) | ✓ | ✓ |
| Change member roles | – | – | – | – | – | ✓ (not self) | ✓ |
| Edit organisation profile & service areas | – | – | – | – | – | ✓ | ✓ |
| Find consenting donors in service area | – | – | – | – | ✓ | ✓ | ✓ |
| Community reports | – | – | – | – | ✓ | ✓ | ✓ |
| Users, locations, settings, audit log, exports, deletions | – | – | – | – | – | – | ✓ |

Invariants checked by the services:

- Nobody verifies their own record, including admins (`self_verification`).
- A community always keeps at least one active leader (`last_leader`).
- The platform always keeps at least one active admin (`last_admin`); granting or removing admin
  rights and exports require the acting admin's password again.
- Other people's records answer *not found* rather than *forbidden*, to avoid confirming that
  they exist (IDOR protection).
