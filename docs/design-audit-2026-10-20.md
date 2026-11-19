# Design audit, 20 October 2026

Scope: the content work (phases 1–6), the locked plan features, and the new
plan-change flow. Lenses: Impeccable's technical audit, design-taste-frontend
for the public pages, and the animate skill for every moving part. Evidence:
the bundled detector, code inspection, and the running app at 375px and
desktop width.

## Health score

| # | Dimension | At the audit | Whole app, after #36 | After #37 | Still between it and 4 |
| --- | --- | --- | --- | --- | --- |
| 1 | Accessibility | 3 | 3 | 4 | — (axe on the screens PR 2 restyles) |
| 2 | Performance | 3 | 3 | 4 | — |
| 3 | Theming | 2 | 3 | 3 | Rounded, shadowed and tinted panels outside settings |
| 4 | Responsive | 3 | 3 | 3 | Document editor, diary week and report tables unchecked at 375px |
| 5 | Implementation integrity | 3 | 3 | 3 | The same drift as Theming, screen by screen |
| **Total** | | **14** | **15** | **17/20** | PR 2: the Ledger pass over the rest of the app |

**A correction.** After #36 this table said 17/20. That raised Theming and
Responsive to 4 on the strength of the settings screens alone; a scan of the
whole app found the same rounded, tinted and shadowed panels on most other
screens (149 `rounded-md`, 54 larger radii, 38 shadows, 42 tinted boxes) and
32px icon buttons throughout. Scored across the whole app it was 15. The
17 above is the whole app after #37.

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

### Fixed in #37: contrast, labels, targets, measured

- **Helper text at 2.6:1.** 166 uses of slate-400 on text, and on the
  only mark of an icon-only control, are now slate-500 (4.8:1). Icons beside
  a label keep slate-400. One label on the dark inspection-approval header
  stays light, where slate-400 is the higher contrast. The em-dash for an
  empty figure moved with them.
- **Muted ink on the grey ground was 4.36:1.** axe found that slate-500,
  which passes on white, fails on the old app ground (#f5f5f5) and on
  slate-100. The ground is now slate-50 (#f8fafc), where it is 4.55:1; this
  fixes about forty page subtitles at once. On the public pages the slate-100
  bands are kept and the text inside them is slate-600.
- **Unnamed controls.** Eight pagination arrows were announced as "link";
  they are "Previous page" and "Next page". The two Add buttons gained a
  label as well as a title. The job board's sideways-scrolling area can now be
  reached and scrolled from the keyboard.
- **White on amber-500 (2.1:1).** The customer list's WhatsApp and Email
  buttons now use the teal outline of the buttons beside them; amber is kept
  for money, as DESIGN.md has it.
- **Touch targets.** Every icon-only control (55 found by a scan, and every
  icon size of the shared Button) carries `.hit-area`: on a coarse pointer an
  invisible 44px square centred on it, with no change to the layout. Checked
  on an emulated phone: a 32×28 WhatsApp button and the 32px help button both
  take a tap 5px outside their drawn edge. Four pagination groups lost the
  `overflow: hidden` that clipped those squares.
- **`transition-all` in the shared Button, Tabs and Switch.** Every button in
  the app inherited it. Now `transition` (colour, shadow, transform) and
  `transition-colors`.
- **Detector: 0 findings across `src`.** The diary's 4px status stripes went;
  the blocks keep their status tint and 1px border. The portal's welcome note
  lost its stripe, and the team screen's tabs use a 1px underline on the rule.
- **axe in the end-to-end suite.** `e2e/accessibility.spec.ts` checks WCAG 2.2
  A and AA on six public pages and twelve signed-in screens against the
  production build, and fails on any violation. It found the ground problem
  above, which no review had.
- **Measured, not assumed.** Production build, Pixel 7 profile, 4× CPU
  slowdown, 1.6 Mbps with 150 ms latency, cache off:

  | Page | JS (compressed) | Total | LCP | CLS |
  | --- | --- | --- | --- | --- |
  | Front page | 168 KB | 289 KB | 1.16 s | 0 |
  | Pricing | 167 KB | 283 KB | 1.01 s | 0 |
  | Sign in | 249 KB | 360 KB | 1.04 s | 0 |
  | Dashboard | 233 KB | 360 KB | 1.01 s | 0 |
  | Customers | 165 KB | 282 KB | 1.00 s | 0 |
  | Jobs | 167 KB | 271 KB | 1.02 s | 0 |
  | Transactions | 163 KB | 281 KB | 1.05 s | 0 |
  | Diary | 167 KB | 282 KB | 1.04 s | 0 |
  | Billing | 159 KB | 272 KB | 1.04 s | 0 |

  Every page is well inside "good" (LCP under 2.5 s, CLS under 0.1). Sign in
  carries about 80 KB more script than the pages around it; worth a look,
  not a defect.

What axe cannot judge is still unjudged: keyboard order through the job
card, invoice and payment, and how those read to a screen reader. The
Browser pane does not deliver real keystrokes, so that needs a person.

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
