# UI SDK component plan

> **Status, 25 November 2026.** Phases 1–2 shipped (#47): Field, Dialog, Alert Dialog, Drawer, with `createConfirm`. The floor app then brought in, with the owner's approval: **Calendar** and **Accordion** (the schedule, #57), **Segmented Control** and **Meter** (the job sheet and the clock, #57–#58), and **Toast** (Undo and Why?, #59–#60). Two traps found on the way: `CalendarDay` is the table cell, so its look goes on an inner element; and a full-width Toast region needs `translate: none`, because UI SDK centres a centre-aligned region with `translate: -50%`. Toggle, Collapsible and Timeline are approved but not yet used.

21 November 2026. A plan only: nothing is installed yet. It maps every
interactive pattern in MOTION to the component UI SDK recommends for it, and
orders the work by the accessibility findings of the critique run the same day
(`.impeccable/critique/`, target `web/src/app`).

## Why UI SDK, and what it does not change

UI SDK (`@ui-sdk/core` plus `@ui-sdk/react`, version 0.1.0-beta.13) supplies
behaviour: keyboard navigation, focus, selection, dismissal, popups, drag and
drop, and the ARIA each needs. It renders no styles of its own. MOTION keeps
its own look, whether that stays the Ledger Page or moves towards SAP Fiori,
and gets the behaviour the critique found missing.

Most of that critique's accessibility findings sit in widgets MOTION built by
hand:

- the customer sheet and the phone navigation drawer do not move, trap or
  restore focus;
- the Process, Split and Send dialogs drop focus to the page on close;
- the site switcher declares a menu without menu keys;
- form errors and hints are not tied to their fields;
- the diary and the job board work by pointer only.

Those are exactly the parts UI SDK ships.

It fits the stack: it needs React 19 (MOTION has 19.2.3) and its components
work in server components, carrying `"use client"` themselves. It is beta, so
pin the exact version and upgrade on purpose.

## The standards MOTION adopts with it

From the UI SDK skill (`~/.claude/skills/ui-sdk`). They apply to every screen,
whether or not a component is migrated yet.

1. **Import from entries.** Use `@ui-sdk/react/select` and the like, never a
   package root or `@ui-sdk/core/internal/*`.
2. **One shape everywhere.** A root and its parts, nested as the component's
   Composition shows. Change a part's element with `render`, never with `as`.
3. **Every control is in a Field.** `Field` with `FieldLabel`,
   `FieldDescription` and `FieldError`. This alone fixes the missing
   `aria-describedby` and `aria-invalid` across every form.
4. **Name every control.** A visible label, or an `aria-label` that names the
   row: "Actions for Courtney Farrell", not "Edit". Names are unique where they
   sit, because people using screen readers and agents both find controls by
   name.
5. **Style from state.** Target `data-slot` and state attributes such as
   `data-open`, `data-pressed` and `data-highlighted`. Never inline styles for
   state, and never generated ids.
6. **Declare the layer.** Put `@layer ui-sdk;` at the top of `globals.css`,
   above `@import "tailwindcss"`.
7. **Check colour in a real browser.** Text needs 4.5:1. Control edges, focus
   rings and state fills need 3:1. A state reads by a fill change, a full
   outline or a weight change, never by a faint tint alone.
8. **Key lists by id.** Never key a list by index.
9. **Mark what needs a person.** Process, Void, Post receipt, Send, Delete,
   Issue and Approve carry `data-agent-confirm` with a sentence written from
   app state. An example: "Processes INV-1020 for N$ 1,820.00 to Courtney
   Farrell's account".
10. **Don't hand-roll what UI SDK ships.** A `role="listbox"`, `"menu"`,
    `"dialog"`, `"radiogroup"` or `"switch"` written into MOTION's markup is a
    bug once the package is installed. Today there are eleven.

## Mapping: what MOTION has → what to use

| MOTION today | Where | UI SDK | Fixes |
|---|---|---|---|
| `components/forms/fields.tsx` (`TextField`, `SelectField`) over 297 inputs | Every form | **Field** + **Input**, **Textarea**, **Number Input** for money (`step={0.01}`), **Date Input** | Errors and hints tied to fields; `aria-invalid`; focus to the first error. Migrating this one file moves most screens. |
| 57 native `<select>`s (ProductForm 7, OrganisationSettings 5, TeamManager 4) | Settings, products, purchasing | **Select** inside a Field | Consistent naming. Commits on item press, not on every arrow key, so the job-board status change stops firing per key on Windows. |
| `components/ui/dialog.tsx` (Radix) for Process, Split and Send | Documents | **Dialog** | Focus returns to the opener on close. |
| 13 `confirm()` / `window.confirm` calls | Void, delete, sign out | **Alert Dialog**, `AlertDialogClose value="confirm"` | A consequence sentence instead of the browser's box, plus `data-agent-confirm`. Sign out gets a confirm. |
| `CustomerSheet.tsx` (`role=dialog`, hand-built) | Customers | **Drawer** from the right | Focus moves in, is trapped, and is restored. |
| `MobileNav.tsx` drawer | Phone navigation | **Drawer** from the left | Same. |
| `HelpDrawer.tsx` | Help | **Drawer** | Already correct; migrate last and use it as the reference. |
| `SiteSwitcher.tsx` (`role=menu` without keys) | Header | **Menu** | Arrow keys, Escape, outside press, focus. |
| Six icon buttons per customer row, two of them dead | Customers, vehicles, suppliers | **Menu**, one per row, trigger named "Actions for {name}", plus a **Tooltip** on any icon-only button kept | Recognition; a name for every action. |
| `components/ui/dropdown-menu.tsx` (Radix, no imports) | — | Delete; **Menu** replaces it | — |
| `EntityPicker`, `CustomerPicker`, `VehiclePicker` (hand-built combobox and listbox) | Documents, payments, bookings | **Combobox** | Keyboard selection and announcements, from one component. |
| Header "Search customers…" | Every page | **Command**: customers, vehicles, documents, plates, and actions such as "New job card" | The power-user accelerator the critique scored lowest. |
| `HelpSearch.tsx` (two comboboxes sharing one `aria-controls`) | Help | **Autocomplete** | Unique ids and correct announcements. |
| `pill-toggle.tsx` (`role=radiogroup`); Day / Week / Month; Transactions and Receipts filter tabs | Diary, transactions | **Segmented Control** for a view switch; links with `aria-current="page"` where each choice is its own URL | The selected state is exposed, not shown by colour alone. |
| `components/ui/tabs.tsx` (no imports) | — | **Tabs** only for in-page panels, such as the customer page's sections | Progressive disclosure of the 40-field customer form. |
| `components/ui/switch.tsx` ("Active", 2.49:1 track) | Team, settings | **Switch** | A 3:1 track and a full-size control. |
| Document toolbar: 8–9 flat buttons | Job cards, invoices, quotes | **Toolbar** (one tab stop, arrow keys) for Print, Send and Convert; **Menu** "More" for Copy, Split, Void and Delete; the primary action alone in a sticky footer bar | Cognitive load: at most four choices at a time. |
| `react-day-picker` (`components/ui/calendar.tsx`) | Dates | **Date Picker** / **Calendar** | One calendar with the same keyboard model as everything else. |
| "Saved" with no role; `role={ok ? undefined : "alert"}` ×13 | Editors | **Toast** for a confirmation that passes; one shared `role="status"` region for "Saved", "Moved JC-1001 to Waiting for parts" and "Change N$ 50.00" | Success is announced, not only errors. |
| Pagination links that stay focusable when disabled | Payments, diary | **Pagination** | Disabled pages leave the tab order. |
| Help "Contents" disclosure; collapsible settings sections | Help, settings | **Collapsible** / **Accordion** | `aria-controls` and the expanded state. |
| File uploads (imports, quotation scans) | Settings import, requisitions | **File Input** | Drop, paste and choose, with names. |
| Login and change-password fields | Auth | **Password Input** | Show and hide, already marked secret for agents. |
| Imports and long jobs | Settings import | **Progress** | Progress announced. |
| Diary booking blocks (`DayView`, `WeekView`: `div` and `li` with pointer handlers only) | Schedule | Your own primitive on **`createGridFocus`** (slots as a grid, each booking a button) with **`createTransfer`** for moving between lanes | The diary becomes operable by keyboard. Drag stays as the enhancement; "Scheduled for" on the job card is the single-pointer alternative. |
| Job board (cards between status columns) | Jobs | Your own primitive on **`createTransfer`** | Keyboard moves, announced: "Moved JC-1001 to Waiting for parts". |
| Native `<table>` ×20 | Lists, reports | No UI SDK table: keep native tables with `scope`. On phones, give the card layout `role="table"`, `"row"` and `"cell"`, or keep `thead` as `sr-only`. | VoiceOver keeps the table on a phone. |

Not UI SDK's job, and needed anyway:

- a skip link to `<main id="main" tabIndex={-1}>` in `DashboardLayout.tsx`;
- an `<h1>` on Customers, Vehicles, Transactions, Receipts and the receivables
  and labour reports (`CardTitle` is a `div` today);
- `generateMetadata` titles on the customer, vehicle and payment pages;
- `Section` headings that follow the page's level instead of a fixed `h3`.

## Styling

- **Decided in phase 1: no `web.css`.** MOTION styles each part with its own
  Tailwind classes, so its look stays one system. UI SDK adds the small
  amount of CSS its behaviour needs (hiding closed popups, dimming behind a
  sheet) itself, in the `ui-sdk` layer declared at the top of `globals.css`.
- Popups and dialogs use the browser's top layer. Tailwind's reset zeroes the
  margin that centres one, so a dialog's content carries
  `fixed inset-0 m-auto h-fit`.
- The pairs to check whenever tokens change:
  - `--ui-foreground` on `--ui-background`;
  - `--ui-muted-foreground` on `--ui-background` and on `--ui-muted`;
  - `--ui-primary-foreground` on `--ui-primary`;
  - `--ui-input`, `--ui-ring` and `--ui-ring-border` on `--ui-background`.
- MOTION's global `:focus-visible` ring is unlayered and already beats every
  component's `outline-none`. Keep it, and point `--ui-ring` at the same
  colour, so there is one focus ring product-wide.
- Without `web.css`, every icon is a lucide `<svg>` rendered inside its part.

## Phases

1. **Foundation.** Install `@ui-sdk/core` and `@ui-sdk/react` at an exact
   version, add the layer and tokens, and migrate `fields.tsx` onto Field and
   Input. Add the skip link, the missing `<h1>`s and the page titles alongside.
   Most of the "errors not tied to fields" findings close here.
2. **Overlays.** Dialog for Process, Split and Send; Alert Dialog for the 13
   confirms; Drawer for the customer sheet and the phone navigation.
3. **Choosing and acting.** Combobox for the three pickers; Menu for row
   actions and the site switcher; Toolbar and a "More" Menu on documents;
   Command for header search; Select for the remaining native selects;
   Segmented Control and `aria-current` for view switches.
4. **Custom primitives.** The diary on `createGridFocus` and `createTransfer`,
   and the job board on `createTransfer`, following the skill's
   `create-component.md`.
5. **Agent-ready.** One `createAgent` bridge in a client module, with
   `data-agent-confirm` on every money and sending action, and the agent test
   for each migrated screen.

Each phase ends as the repository's other parts do:

- `tsc` and `eslint` are clean;
- unit, database and browser tests pass;
- every migrated screen is added to `e2e/accessibility.spec.ts`.

The axe suite should also gain two things. The first is a phone run, since it
is desktop only today. The second is the best-practice rules that would have
caught the missing headings: `page-has-heading-one`, `heading-order` and
`landmark-unique`.

## Tests

UI SDK's own guidance tests components with Vitest, jsdom and Testing
Library. MOTION has no component-test layer today: it has `node:test` unit
tests, `.dbtest.ts` database tests, and Playwright. Phase 1 adds a fourth
layer (`vitest`, `jsdom`, `@testing-library/react`,
`@testing-library/user-event`). Every migrated interface gets:

- a wiring test: names, values, callbacks, Space on every switch and
  checkbox, and focus returning when a dialog or menu closes;
- the agent test from the skill's `agent-ready.md`.

## Risks

- **Beta.** APIs can change between betas. Pin the exact version and read the
  changelog before each upgrade.
- **Page weight.** The baseline is 160–250 KB of JavaScript gzipped per page.
  Measure each phase against it with the `motion-prod` preview, and import
  per-component entries only.
- **Two libraries for a while.** Radix and UI SDK will coexist until phase 3
  ends. Delete each Radix wrapper in `components/ui/` as its last import goes.
- **Phones.** A native `<select>` opens the phone's own picker, which mechanics
  know. Check the UI SDK Select on a real phone before migrating the PWA's
  selects. If it is worse, keep native selects there; agents don't drive the
  floor app.
