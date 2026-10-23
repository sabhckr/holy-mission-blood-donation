# Design system

The visual reference is the simple theme supplied by the project owner (ivory page `#fffaf7`,
crimson `#a71930`, ink `#252b33`, muted `#6b7077`, soft red and soft green notes). Three of its values
were darkened for accessibility: muted text is `#62676e` (at least 4.8:1 on every tinted surface), input
borders use `#958a84` (3.4:1) and the focus ring is crimson instead of pale pink. Keep text short and essential.

The goal is a site anyone can use on a cheap Android phone, in Bangla, under stress: one clear
action per screen, short sentences, big touch targets, and status shown with colour **and** words.

Styles are plain CSS. Tokens and shared components live in `src/app/globals.css`; page-area
additions go in `src/app/styles/public.css`, `account.css` and `admin.css` (all imported by the root
layout). Do not add a CSS framework or inline colours — use the tokens.

## Principles

1. **One primary action per screen.** Use one `btn btn-primary`; everything else is `btn`,
   `btn-soft` or a `section-link`.
2. **Show, don't explain.** Prefer an icon + short label + one-line hint over a paragraph. Long
   explanations go in a `details.disclosure` ("আরও জানুন") or the help page.
3. **Status = colour + icon + words.** Never colour alone. Use `Badge`, `AvailabilityBadge`,
   `VerificationBadge` and the `urgency-*` pills.
4. **Phone first.** Design at 390px wide, then widen. No horizontal scroll at 360px. Touch targets
   at least 44px.
5. **Bangla first.** Bangla needs line-height 1.35 or more for headings and 1.6 for body text. Keep
   lines short (`max-width: 65ch`).
6. **Accessible.** Real labels on every field, visible focus, `aria-current` for the current page,
   headings in order, icons `aria-hidden` with text beside them.

## Tokens

| Token | Use |
|---|---|
| `--brand` `#a71930`, `--brand-strong` `#861528`, `--brand-deep` | Primary buttons, blood group tiles, active states |
| `--brand-soft`, `--brand-tint`, `--brand-line` | Soft backgrounds and borders for brand elements |
| `--ink`, `--ink-2`, `--muted` | Text: headings, body, secondary |
| `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong` | Page, cards, subtle fills, borders |
| `--success*`, `--warning*`, `--info*`, `--danger*` | Status (each has `-soft` background and `-line` border) |
| `--radius-lg` 24, `--radius` 18, `--radius-sm` 12, `--radius-xs` 8 | Hero cards, cards, inputs/buttons, small chips |
| `--shadow-sm`, `--shadow`, `--shadow-lg` | Resting cards, hover, floating panels |
| `--space-1` … `--space-8` | 4, 8, 12, 16, 24, 32, 48, 72px |

## Components (class names)

- Layout: `container`, `container-narrow`, `section`, `section-band`, `stack`/`stack-sm`/`stack-lg`,
  `cluster`/`cluster-sm`, `grid grid-2|3|4`, `layout-sidebar` (sticky side nav on desktop),
  `section-head` (title + link row).
- Page top: `PageHeader` (`page-header`, breadcrumbs, title, intro, optional actions).
- Cards: `card`, `card-tight`, `card-link` (whole card clickable, lifts on hover), `card-accent`
  (brand edge, for the one thing to notice), `card-muted` (empty/quiet), `card-title`.
- Buttons: `btn` + `btn-primary` | `btn-soft` | `btn-dark` | `btn-ghost` | `btn-danger`, sizes
  `btn-sm`, `btn-lg`, `btn-block`.
- Forms: `form-section` (a card; its `legend` is the card heading), `field`, `field-row`, `label`,
  `hint`, `input`/`select`/`textarea`, `check`, `choice-group` + `choice-grid` + `choice-tile`
  (big tappable radio tiles, e.g. blood groups), `form-actions`.
- Feedback: `Alert` (`alert-info|success|warning|error`), `Badge`, `EmptyState`, `Stat`
  (with optional `icon`).
- Blood: `BloodGroupBadge` (solid red tile), `group-picker` + `group-chip` (one-tap group links).
- Home: `hero`, `task-grid` + `task-tile` (`task-tile-primary` for the main task), `area-banner`,
  `stats-row`, `steps`.
- Navigation: thin red `topline`, header with logo, `nav-quick` links (≥900px), the `lang` toggle and
  one `nav-mobile` menu for everything (all screen sizes),
  section nav `side-nav` (chips on phones, list on desktop).
- Disclosure: `details.disclosure` with a `summary` (chevron is automatic).

## Copy

Write like a helpful neighbour: short, direct, polite (আপনি). One idea per sentence. Use the
glossary in `src/i18n/messages` (রক্তদাতা, রক্তের জন্য অনুরোধ জানান, সংগঠন নিবন্ধন করুন …).
The slogan "রক্ত লাইগলে রক্ত আছে, এত ডরানোর কী আছে?" is never changed. Every visible string comes
from the dictionaries (a unit test fails on hard-coded text) and has both `bn` and `en`.
