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
| 3 | Theming | 2 → 4 | Settings used rounded, tinted cards and two teals (fixed in the follow-up) |
| 4 | Responsive | 3 → 4 | Settings menu was 1,260px wide on a 375px phone; drawer rows were 32px (both fixed) |
| 5 | Implementation integrity | 3 | One detector finding (fixed); the voice and glossary hold |
| **Total** | | **14/20 → 17/20** | **Good** at the audit; every P2 since resolved |

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

### Fixed in the follow-up pull request

- **[P2] Settings section drifted from the Ledger Page** (`/impeccable
  polish`). Every settings screen is now square (`rounded-sm` on controls,
  none on panels and tables), with no drop shadows. The tinted alert boxes
  (teal-50, amber-50) are one component, `components/ui/notice.tsx`: white
  ground, hairline, and a 1px marker down the left, teal for information
  and amber for money that needs attention. It serves Billing's locked and
  read-only notices, the tax note, the team invitations, the API key shown
  once, and the import result. The WhatsApp preview bubble keeps its own
  colour, because it pictures a message, not MOTION.
- **[P2] Two teals** (`/impeccable colorize`). One accent: teal-700
  (#0f766e) for every button, link and marker in the app, hovering to
  teal-800, and `--primary` in `globals.css` set to the same value. White on
  it is 5.5:1; on teal-600 it was 3.7:1, below AA for a button label. The
  public pages' solid buttons moved to teal-700 for the same reason. Their
  teal-600 icons, dots and rules stay: they are not text, and 3.7:1 clears
  the 3:1 that graphics need.
- **[P2] Sidebar targets were ~32px tall** (`/impeccable adapt`). On a
  touch screen (`pointer: coarse`) the sidebar and settings menu rows are
  44px with 14px labels and 16px icons. A mouse keeps the compact rows.
- **[P3] `OnThisPage` marker used `transition-all`** (`animate`). The
  marker is now a 1px line moved and stretched with `transform` alone
  (`translateY` and `scaleY` from the top), 180ms on the strong ease-in-out.
  Under reduced motion it jumps instead.
- **[P3] Development-only hydration warning on the landing page.** Traced to
  the session lookup at the top of the page: any wait before rendering made
  the page stream after the shell around it, and React lost the match about
  four loads in five. The page now renders at once. A visitor with a session
  cookie is sent by the proxy to `/start`, which looks the session up and
  goes on to their workshop, or clears a dead cookie and returns them to the
  front page. Five clean loads out of five after the change.

### Kept, with the reason

- **[P3] Landing hero carries a price line under its buttons.** The
  marketing lens treats a pricing line in the hero as clutter. Kept
  deliberately: in this market the price is the first question, and the line
  is short. Revisit only if the hero is redesigned.

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
