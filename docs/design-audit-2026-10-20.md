# Design audit, 20 October 2026

Scope: the content work (phases 1–6), the locked plan features, and the new
plan-change flow. Lenses: Impeccable's technical audit, design-taste-frontend
for the public pages, and the animate skill for every moving part. Evidence:
the bundled detector, code inspection, and the running app at 375px and
desktop width.

## Health score

| # | Dimension | Score | Key finding |
| --- | --- | --- | --- |
| 1 | Accessibility | 3 | Locked menu items were 2.6:1 contrast (fixed) |
| 2 | Performance | 3 | Registration progress bar animated `width` for 500ms (fixed) |
| 3 | Theming | 2 | Settings and Billing use rounded, tinted cards the Ledger Page rejects |
| 4 | Responsive | 3 | Settings menu was 1,260px wide on a 375px phone (fixed) |
| 5 | Implementation integrity | 3 | One detector finding (fixed); the voice and glossary hold |
| **Total** | | **14/20** | **Good**, with Theming the weak dimension |

**Integrity verdict: pass.** The public pages and the signed-in app each
express their own coherent system: the iso/spine world outside, the Ledger
Page inside. The six content phases removed every eyebrow label above a
heading, the copy follows one glossary, and the detector found one
anti-pattern in the files changed (the sidebar's 2px coloured marker).

## Findings

### Fixed in this pull request

- **[P1] Locked menu items failed contrast.** `SidebarNav.tsx` and the
  settings menu drew locked items in slate-400 (#94a3b8): 2.6:1 on white,
  below WCAG AA 4.5:1 for 11–14px text. Now slate-500 (4.8:1). The lock
  icon and "included in the … plan" text still mark them.
- **[P1] Settings menu overflowed on phones.** `settings/layout.tsx`
  laid thirteen items in one unwrapped row: 1,257px of menu in a 343px
  column, labels squeezed into three-line stacks, and the page pushed
  sideways. Below `lg` it is now one row that scrolls on its own, edge to
  edge; nothing else on the page moves. Pre-existing, not from the content
  work.
- **[P2] Registration progress bar animated layout.** `StepProgress.tsx`
  transitioned `width` over 500ms. Now `transform: scaleX()` over 240ms on
  the strong ease-out; reduced motion keeps the instant change.
- **[P2] Sidebar used `transition-all` and a 2px marker.** Now
  `transition-colors` (150ms) and the 1px teal left marker DESIGN.md
  specifies; corners `rounded-sm` rather than `rounded-lg`.
- **[P3] One visible em-dash on a public page.** The register form's
  "quoted per site —" is now a colon.

### Open, recommended next

- **[P2] Settings section drifts from the Ledger Page.** Billing and its
  siblings use `rounded-lg` cards and tinted alert boxes (teal-50, amber-50);
  DESIGN.md calls for square panels, hairlines and no tinted cards. The new
  plan-change screens follow DESIGN.md, so the section is now visibly mixed.
  → `/impeccable polish` on `settings/*`.
- **[P2] Two teals.** DESIGN.md's accent is teal-700 (#0f766e); most app
  buttons are teal-600. The new flow uses teal-700. → `/impeccable colorize`
  to settle one value as a token.
- **[P2] Sidebar targets are ~32px tall.** Below the 44px touch minimum in
  the phone drawer, which reuses the desktop sidebar. → `/impeccable adapt`.
- **[P3] Landing hero carries a price line under its buttons.** The
  marketing lens treats a pricing line in the hero as clutter. Kept
  deliberately: in this market the price is the first question, and the line
  is short. Revisit only if the hero is redesigned.
- **[P3] `OnThisPage` marker uses `motion-safe:transition-all`.** Name the
  property (`transform` / `top`). → `/impeccable animate`.
- **[P3] Development-only hydration warning on the landing page.** About two
  loads in five, none in production (checked on 10 October). Leave unless
  it reaches a production build.

### False positives, checked

- **Ungated hover motion** on public buttons and help cards: Tailwind v4's
  `hover:` variant applies only on devices that can hover, so touch screens
  never see it.
- **Dark mode absent**: deliberate; DESIGN.md records the product as light
  only and the status bar says so.

## The plan-change flow, against the same lenses

- **Ledger Page:** square panels, hairlines, one teal, tabular figures,
  labels naming structures only; no tinted cards, no eyebrows.
- **Progress:** a segmented rule, one segment per step, teal once reached.
  On a phone the four labels give way to "Step 2 of 4: Review" so nothing is
  cut short; screen readers hear every step at every width.
- **Motion (animate):** a step a few times a year is the "occasional" tier
  and allowed to be seen. Purpose: state indication. CSS transition on
  `transform` only, 240ms, `cubic-bezier(0.23, 1, 0.32, 1)`, off under
  reduced motion. The route keeps the bar mounted between steps so the fill
  is a real transition.
- **States:** choose, review, payment or approval, applied; refused requests
  explain why (overdue, already pending, quoted plan); one open request per
  workshop is enforced in the database.
