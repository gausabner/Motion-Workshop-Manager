---
name: MOTION Workshop Manager
description: A workshop's books on screen — white ground, hairline structure, one teal for anything that acts.
colors:
  ink: "#0f172a"
  ink-strong: "#1e293b"
  secondary-ink: "#475569"
  muted-ink: "#64748b"
  faint-ink: "#94a3b8"
  accent: "#0f766e"
  accent-hover: "#115e59"
  accent-tint: "#f0fdfa"
  hairline: "#e2e8f0"
  hairline-faint: "#f1f5f9"
  field-edge: "#cbd5e1"
  surface: "#ffffff"
  surface-sunken: "#f8fafc"
  surface-band: "#e2e8f0"
  app-ground: "oklch(0.97 0 0)"
  overdue: "#b91c1c"
  caution: "#b45309"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  dense:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    fontFeature: "tabular-nums"
rounded:
  none: "0px"
  sm: "2px"
  pill: "9999px"
spacing:
  hair: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  lg: "20px"
  section: "36px"
  band: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.figure}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.sm}"
    size: "32px"
  button-icon-hover:
    backgroundColor: "{colors.hairline-faint}"
    textColor: "{colors.ink}"
  link-action:
    textColor: "{colors.accent}"
    typography: "{typography.dense}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "40px"
  input-field-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  panel-flat:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0px"
  panel-header-band:
    backgroundColor: "{colors.surface-band}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "56px"
  panel-footer-summary:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.muted-ink}"
    padding: "12px 16px"
  table-head-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    padding: "8px 12px"
  table-row-zebra:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.secondary-ink}"
    padding: "8px 12px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.dense}"
    padding: "4px 0 4px 12px"
  rail-item-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    padding: "4px 0 4px 12px"
  section-label:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
  drawer-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 16px"
    width: "448px"
---

# Design System: MOTION Workshop Manager

## Overview

**Creative North Star: "The Ledger Page"**

MOTION looks like a well-kept book of account rendered at screen resolution. Structure is drawn with 1px slate rules rather than with shadows and boxes; a heading is a heading because a hairline runs under it, and a group of figures is a group because a rule closes it. Nothing floats unless it is genuinely floating above the page. The ground is white, the ink is near-black slate, and exactly one colour — a deep teal — marks anything that acts or anything that is where you are. Every figure is somebody's money, so figures are tabular by default and columns of them line up down the page whether or not a screen remembered to ask.

Density is high and deliberate. The signed-in app is read at a counter by somebody being interrupted: 14px and 11-13px carry most of it, labels drop to 10px uppercase, and the vertical rhythm is tight enough that a whole report fits above the fold. The help library, built inside this same world, is the one place the ramp opens up — 15px body at 1.7 on a 68-character measure, a 30px title — because a manual is read in sentences rather than scanned in columns. Same palette, same hairlines, same teal, same near-zero corners; only the reading scale changes.

The confirmed rejection is decoration. There is no gradient, no tinted card, no coloured chrome, no illustration, and no second accent competing with the teal. Where other systems reach for a raised card, MOTION draws a rule. Where they reach for a badge colour, MOTION reaches for weight. Light only: dark tokens exist in `globals.css` and nothing in the product switches to them.

**Key Characteristics:**
- White ground, slate-900 ink, a single deep-teal accent on anything actionable or current
- 1px slate-200 hairlines carry the structure that shadows carry elsewhere
- Near-zero corners: square by default, 2px at most, pills only on the round-affordance leftovers
- 10px uppercase tracked labels naming structures — columns, groups, panels
- Tabular numerals on every figure, set globally rather than per screen
- Lucide icons at strokeWidth 1.75, sized 12-20px, never as a decorative motif
- Tables become stacked cards below 768px; nothing scrolls sideways to be read
- Light only, and the status bar says so (`themeColor: "#ffffff"`, `colorScheme: "light"`)

## Colors

A slate-and-white palette with one teal, and two warning hues that are allowed to exist only because money can be late or wrong.

### Primary
- **Workshop Teal** (`{colors.accent}`): the only colour that acts. Links, the current item's 1px rail marker, the leading rule beside an answer, the numeral on a step, a credit balance, the focus ring, the caret, the selection wash at 18%. Used on 251 occurrences against a palette otherwise made of slate, which is the intended proportion.
- **Workshop Teal Pressed** (`{colors.accent-hover}`): hover and active on filled teal.
- **Teal Wash** (`{colors.accent-tint}`): the faintest tinted ground, for a selected or affirmed row. Rare by design.

### Neutral
- **Ledger Ink** (`{colors.ink}`): headings, titles, the value a reader came for, the active rail item.
- **Body Ink** (`{colors.ink-strong}` / `{colors.secondary-ink}`): running prose and table values.
- **Muted Ink** (`{colors.muted-ink}`): labels, captions, questions under a title, secondary counts. The most-used text colour in the app, which is correct for a surface made mostly of labels.
- **Faint Ink** (`{colors.faint-ink}`): icons at rest, scrollbar thumb hover, the em-dash standing in for an empty figure.
- **Hairline** (`{colors.hairline}`): the workhorse. Every structural division in the product is this, 1px.
- **Faint Hairline** (`{colors.hairline-faint}`): the lighter divider used between rows of a list where a full hairline would over-rule the stack.
- **Field Edge** (`{colors.field-edge}`): the resting border of a text field, one step darker than a structural hairline so a field reads as a control.
- **Paper** (`{colors.surface}`): the ground of every surface a reader looks at.
- **Sunken Paper** (`{colors.surface-sunken}`): zebra rows, table heads, footer summaries, the note block's ground at 70% opacity.
- **Band Slate** (`{colors.surface-band}`): the filled header band at the top of a report panel.
- **App Ground** (`{colors.app-ground}`): the body colour behind everything, a near-white grey. Surfaces paint pure white on top of it.

### Tertiary
- **Overdue Red** (`{colors.overdue}`): one job only — a figure or state that is past due or has failed. Never a brand colour, never a button.
- **Caution Amber** (`{colors.caution}`): a state that needs attention but is not yet wrong.

### Named Rules
**The One Teal Rule.** Teal means "this acts" or "you are here", and nothing else. A decorative teal, a teal heading, or a teal panel ground breaks the signal that makes the accent readable at a glance.

**The Hairline Rule.** Structure is a 1px slate-200 rule. Reach for a rule before reaching for a border-box, a tint, or a shadow. If a division needs more emphasis than a hairline, the answer is a label above it, not a heavier line.

**The Red Is A Verdict Rule.** Red and amber report the state of money and nothing else. They never carry brand, emphasis, or category.

## Typography

**Body Font:** Geist (self-hosted via `next/font`, falling back to the system sans stack)
**Mono Font:** Geist Mono (`--font-geist-mono`; available, used sparingly)

**Character:** A neutral, high-legibility grotesque with genuinely tabular figures — chosen because this product is read in columns of money by people who are not looking carefully. It has no voice of its own, which on a books screen is the correct amount of voice. Note that the face only began rendering as intended when the font variables moved from `<body>` to `<html>`: `@theme inline` maps `--font-sans` at `:root`, so every earlier screen fell back to the system stack while still downloading Geist.

### Hierarchy
- **Display** (600, 30px, leading-tight, tracking-tight): the title of a reading page. One per page.
- **Headline** (600, 19px): a section heading inside an article; carries an anchor.
- **Title** (400, 17px, 1.6): the lead sentence — the answer before anything else — and the compact title inside a panel.
- **Body** (400, 15px, 1.7): running prose, capped at a 68-character measure.
- **Dense** (400, 13px, ~1.45-1.65): rail items, captions, drawer prose, secondary lines under a title. Below the reading scale, this is the app's normal.
- **App workhorse** (400/500, 14px and 12px via `text-sm` / `text-xs`): the signed-in app's table and form scale, 900+ occurrences.
- **Figure** (500-700, 14-16px, tabular): amounts and totals.
- **Label** (600, 10px, 0.05em, uppercase): names a structure — a column, a group, a panel, a summary figure. A denser variant exists in the sidebar at 9px / 0.12em.

### Named Rules
**The Label Names A Structure Rule.** The 10px uppercase tracked label belongs to a thing that contains other things: a table column, a topic group, a panel header, a figure in a summary strip. It never sits above a heading as a kicker or an eyebrow, and it never introduces prose.

**The Measure Rule.** Prose is capped at 68 characters (`max-w-[68ch]`). Whatever the viewport does, a paragraph does not get wider; the third column disappears before the measure does.

**The Answer First Rule.** A reading page opens with one sentence at 17px behind a 1px teal rule. Somebody who reads only that sentence has still been helped.

**The Tabular Rule.** Figures are tabular. `table td`, `table th` and `[data-money]` get `font-variant-numeric: tabular-nums` globally so a new screen cannot forget it; `.tabular` is the opt-in for figures outside a table.

## Layout

The signed-in app is a fixed 180px slate-50 sidebar plus a 56px (60px at `lg`) white header band, with content in a `max-w-7xl` centred column. Below 768px the sidebar becomes a bottom tab bar of four 56px targets and a slide-in drawer at 280px / 85% max.

Reading surfaces use a three-column manual inside `max-w-6xl` (72rem) with a 40px gutter between columns: a 224px topic rail at left, sticky under the masthead at `calc(100dvh - 3.5rem)`; the article column at its 68ch measure; a 192px "on this page" rail at right that appears only at `xl` and above. (The brief proposed 240px and 200px rails; the build settled at 224px and 192px, and the build is the record.)

Breakpoints, as used: **md 768px** — the tablet line where tables become cards, the tab bar appears, and single-row chrome splits into two; **lg 1024px** — where the topic rail becomes a rail rather than a disclosure; **xl 1280px** — where the third column is affordable. Responsive behaviour is subtractive: the right rail leaves, then the left rail collapses to one disclosure, and the article takes the full width inside a 16px gutter. Nothing is shrunk to fit.

Spacing rhythm is a 4px base, worked mostly in 4 / 8 / 12 / 16 / 20 / 36. 16px is the universal gutter on a phone, 36px (`py-9`) is the page's top and bottom air, and vertical separation between groups is 20-48px depending on whether a hairline is also doing the work. Header heights are 56px throughout — masthead, panel band, tab target — which is what makes sticky offsets (`top-14`, `scroll-mt-24`, `sticky top-24`) land.

## Elevation & Depth

**This system is flat.** Depth is tonal and linear, not cast. A surface is distinguished from the surface behind it by a 1px hairline and, when it needs more, by a one-step tonal change (white against `surface-sunken`, or the filled `surface-band` at the top of a report). Resting elements have no shadow: report panels explicitly override the component library's default with `shadow-none`, and the first move on any new panel should be the same.

Shadow appears only on things that are genuinely floating above the page and must be read as detached from it — a search result list, a slide-in drawer, a mobile nav sheet. It is always soft, always downward-diffuse, always tinted with slate rather than pure black, and never offset hard.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 10px 15px -3px rgb(15 23 42 / 0.05), 0 4px 6px -4px rgb(15 23 42 / 0.05)`): a result list or menu hanging under its trigger, over a 1px slate-200 border.
- **Panel** (`box-shadow: 0 25px 50px -12px rgb(15 23 42 / 0.10)`): a drawer or sheet that has come in from an edge, over a 1px border on the edge it came from.
- **Scrim** (`background: rgb(15 23 42 / 0.20)` desktop, `/0.40` mobile sheet): the work stays visible behind a panel; it is dimmed, never hidden.

### Named Rules
**The Flat-At-Rest Rule.** Nothing that belongs to the page has a shadow. If an element is not floating above the page, its depth is a hairline and a tone.

**The Border Comes With The Shadow Rule.** Every floating surface carries both a 1px slate border and its soft shadow. The border does the work on a display that renders the shadow away.

## Shapes

Square is the default. Structural surfaces — report panels, help fields, result lists, drawers, tables, the note block — are 0px. `rounded-sm` (2px) is the standard softening on a small interactive target: an icon button, a hover ground, a chip. Nothing in the product needs more than that, and the 8px+ radii that appear in the component library's stock defaults are overridden wherever a screen was actually designed.

Two pills survive and are legitimate: the global search field in the app header and the avatar/notification round targets beside it, where a full radius reads as a chrome affordance rather than a content container. Radius never carries meaning — it is only a hit-target courtesy.

Silhouette is rectangular and edge-to-edge. Panels run to the full width of their column and are closed by rules top and bottom rather than by a floating card inset from its ground. The recurring geometry is the **left marker**: a 1px vertical rule at the left edge of an item, slate-200 at rest and teal-700 when that item is current or is the answer. It is the system's one signature form, and it appears on the topic rail, the "on this page" rail, the lead answer, and a defined term.

## Components

### Buttons
- **Shape:** square-ish; 2px corners (`rounded-sm`) on icon buttons, 2px on text buttons. 36px default height, 32px small, 40px large.
- **Primary:** filled teal, white label, 14px medium, 16px side padding.
- **Hover / Focus:** hover deepens the teal one step; focus is the global 2px teal outline at 2px offset, keyboard-only. Transitions are colour-only, 150ms.
- **Outline / Ghost:** white ground with a slate-200 border and slate-700 label; ghost is bare, taking a `surface-sunken` ground and ink-dark label on hover. Icon-only buttons are 32px squares of faint ink that darken and take a faint ground on hover.
- **Touch:** on coarse pointers a press scales to 0.985 so the control answers the finger rather than the lift; suppressed under `prefers-reduced-motion`.

### Cards / Containers
- **Corner Style:** square (0px). The stock `rounded-xl` card is overridden on every designed screen.
- **Background:** white, on the near-white app ground.
- **Shadow Strategy:** none at rest — see Elevation.
- **Border:** 1px slate-200 all round; internal divisions are the same hairline, and row-to-row divisions drop to `hairline-faint`.
- **Header:** an optional 56px filled `surface-band` strip with a 20px icon and a bold 18px title.
- **Footer:** a `surface-sunken` strip at 12px/16px carrying the count on the left and a summary `<dl>` of labelled tabular figures on the right.
- **Internal Padding:** 0 on the panel (content owns its own), 16px horizontal inside strips, 8px vertical on table cells.

### Inputs / Fields
- **Style:** white ground, 1px `field-edge` border, square, 40px tall, 12px side padding, with a 16px lucide glyph in faint ink leading the field.
- **Focus:** the border goes teal (`focus-within:border-teal-700`) and the native outline is suppressed on the input itself, so the whole field reads as focused rather than just the text box. Keyboard focus anywhere else in the product is the global 2px teal outline.
- **Mobile:** 16px text on the input at coarse pointers, non-negotiable — anything smaller and iOS Safari zooms the page on tap and does not zoom back.
- **Caret:** teal, product-wide.

### Tables
- **Head:** white or `surface-sunken` ground, 10px uppercase tracked labels in muted ink, closed by a hairline.
- **Body:** zebra rows alternating white and `surface-sunken`, `hairline-faint` dividers, 8px/12px cells, values right-aligned and tabular where they are figures, the identifying cell at medium weight.
- **Hover:** one step darker than the zebra.
- **Empty:** a single centred sentence in muted ink at 14px, written as a fact about the business rather than "no results".
- **Mobile:** mark the table `data-mobile="cards"` and below 768px it becomes a stack of one card per record — identifying field leading at 15px/600, supporting fields prefixed by their 11px uppercase label, comparison-only columns hidden with `data-mobile="hide"`.

### Navigation
- **App sidebar:** 180px, `surface-sunken` ground, hairline on the right, 11px medium items in a 1px-gap grid, group captions at 9px/0.12em uppercase in faint ink, 12px icons.
- **App mobile:** a four-column bottom tab bar of 56px targets with a hairline top edge, 10px labels under 20px icons, plus `env(safe-area-inset-bottom)`. Anything else fixed to the bottom of a screen must use `.above-tab-bar` or it sits behind the bar and is simply not there.
- **Reading rail:** the left-marker form — 13px items, slate-600 at rest against a slate-200 marker, ink-dark against a teal-700 marker when current, marker darkening to slate-400 on hover. `aria-current="page"` on the active item.
- **Reading rail on a phone:** one disclosure row with a 10px "Contents" label above the current title at 13px/500 and a 16px chevron that rotates 180 degrees over 200ms. Suppressed where the page below already prints the same list.

### The Screen-Keyed Drawer (signature)
Help over the work, already on the right page. A right-anchored white panel at `max-w-md`, full height, square, with a hairline left edge and the Panel shadow, sliding in over a 20%-slate scrim in 200ms with `motion-safe:` guarding the animation. Three stacked regions divided by hairlines: a 56px header with a 10px uppercase panel label and a 32px close target; a search row; and the scrolling article at a step down in scale (13px/1.65 body, 17px title) rendered by the *same* component as the full page, never a second rendering of the same content. The work stays visible behind it — this is a panel beside the task, not a place you have gone instead. The trigger is a bare 32px icon button; the panel's code is loaded only on first press.

### Notes and Terms
- **Note:** a hairline top-and-bottom band on `surface-sunken` at 70%, 12px side padding, with a 16px info glyph in faint ink. One tone only — three colours of callout teaches the reader to ignore two of them.
- **Term:** a 1px `field-edge` left marker with the term at 13px/600 ink-dark and its definition in secondary ink.
- **List:** the bullet is a 10px hairline, not a glyph. The page is built from rules; so are its lists.
- **Steps:** a teal tabular numeral in a 16px right-aligned column, so a list running past nine keeps its text aligned.

## Do's and Don'ts

### Do:
- **Do** draw structure with a 1px `hairline` rule before reaching for a box, a tint, or a shadow.
- **Do** keep the accent to things that act or say "you are here" — The One Teal Rule.
- **Do** set panels and fields square, and cap any softening at 2px (`rounded-sm`).
- **Do** open a reading page with one 17px sentence behind a teal left marker.
- **Do** cap prose at 68 characters and drop a column rather than widen the measure.
- **Do** label a structure with the 10px/600/0.05em uppercase label — a column, a group, a panel, a summary figure.
- **Do** give every figure tabular numerals; use `[data-money]` or `.tabular` outside a table.
- **Do** mark any comparison table `data-mobile="cards"` and annotate its cells, so it stacks below 768px instead of scrolling sideways.
- **Do** use lucide at `strokeWidth={1.75}`, sized 12-20px, and mark it `aria-hidden` when a label is already present.
- **Do** set the input's own font-size to 16px at coarse pointers.
- **Do** wrap entrance and movement in `motion-safe:` and keep transitions to colour at ~150ms.
- **Do** give a floating surface both a 1px border and its soft shadow.
- **Do** override the component library's stock radius and `shadow-sm` on any panel you design (`rounded-none shadow-none border border-slate-200`).

### Don't:
- **Don't** put a shadow on anything that belongs to the page. Flat at rest.
- **Don't** use a hard offset shadow; this is not a neobrutalist world.
- **Don't** introduce a second accent, a gradient, a coloured panel ground, or a tinted card. Red and amber report the state of money and nothing else.
- **Don't** set the 10px uppercase label above a heading as a kicker or an eyebrow. It names a structure or it is not used.
- **Don't** reach for a radius above 2px on a content container; the pill is reserved for the app header's round chrome.
- **Don't** use a glyph or a character as a bullet, a divider, or an icon — a hairline or a lucide icon, nothing else.
- **Don't** render the same content twice from two components; one renderer, a `compact` scale.
- **Don't** ship a dark variant. The product is light only, `colorScheme: "light"`, and the dark tokens in `globals.css` are dormant.
- **Don't** put a figure in a column of figures without tabular numerals. Money that does not line up is a defect, not a preference.
- **Don't** fix an input-zoom or a tap-highlight problem by disabling zoom or hover; fix the cause, as the platform layer in `globals.css` does.
