# Requisitions: brief and plan

Shaped on 19 November 2026. The benchmark is a council's paper form, "Requisition for Supplies" (Prime Press 042021, serial 1367550). Nothing here is built yet, and this document is the brief to confirm before any code.

## 1. What a requisition is

A requisition is an internal, approved request for goods. It is not an order. It settles "may we have this, and who pays?" before anyone takes an item off a shelf or contacts a supplier. The purchase order comes later, and it is the commitment to a supplier.

One requisition can be met in two ways:

1. **From stock.** Stores issues the goods, the receiver signs for them, and the cost is charged to the job or vote on the form.
2. **By purchase.** What stores cannot supply becomes a purchase: quotations according to value, a purchase order, delivery, and a supplier invoice matched against the order and the delivery.

Requester, approvers, storeman and receiver are different people. Separating them is the control the paper form exists to enforce.

In Namibia, councils fall under the Public Procurement Act 15 of 2015. Each council has an accounting officer, a procurement committee and a procurement management unit, and under the 2017 regulations also a bid evaluation committee. The end-user department starts the request. The procurement management unit runs the buying method, which depends on value (Regulation 3, Annexure 2, amended by GN 259 of 2026). MOTION records and enforces the council's own limits. It never hard-codes the law's figures, which change and which we have not been able to confirm.

## 2. The paper form, and where each box goes

| On the form | Meaning | In MOTION |
| --- | --- | --- |
| Serial 1367550, printed in red | Every form is accounted for, spoilt ones too | Its own number series (`REQ-`), issued on submit and never reused. A cancelled requisition keeps its number. |
| Dept. / Room No. | The department asking, and where it is | Department (from a list) and location (free text) |
| Item No. (boxed) | Stock code | `Product.itemCode`, or free text for a non-stock item |
| Articles | Description | Line description |
| Quantity, Rates, Value N$ / c | How many, unit price, line value | Quantity, estimated unit cost, line value (excluding VAT, as stores records it) |
| Inventory | Stock reference | On hand shown beside each stock line; to be confirmed with the council |
| Job or Vote No. (boxed) | What the cost is charged to | A job card in MOTION, or a vote from the council's vote list |
| Requisitioned by: name, date, signature | Who asked | The signed-in person who submits |
| Approvals: PC | The Foreman's sign-off (confirmed by the user on 19 Nov 2026) | Foreman approval |
| Approved by: Divisional Head | The manager: authorises the need and the spend | Divisional Head approval |
| Received the above: verified by | Stores confirms what was handed over | The storeman issuing, recorded as verifier |
| Received the above: name, Pay No., signature | Proof of handover to a named employee | The receiver's name and pay number |

## 3. Decisions made

- **Councils, required.** Requisitions are a Council-plan feature, shown locked (not hidden) on other plans, as with every plan feature. On a council, a purchase order can only be raised from an approved requisition.
- **One requisition covers stock issue and purchase,** as the paper form does.
- **Sign-offs recorded, in this order:** the Foreman, then the Divisional Head (who is the manager), then a further approval above a value limit, then stores verification of the issue, then the receiver with a pay number.
- **One charge code per requisition,** a job card or a vote, as on the paper.
- **The receiver signs on paper.** Stores records their name and pay number, and the printout carries the line for the wet signature.

## 4. The brief

**Job and audience.** These are the council workshop's staff, working in Operate mode. The people involved:

- **The requester,** often a mechanic or foreman on a phone, wants parts for a job or consumables for the section, now.
- **The Foreman and the Divisional Head** (the manager) approve between other duties, often away from a desk.
- **The storeman** (Parts & Stock) issues from the shelf or turns the rest into orders.
- **The receiver** collects the goods.
- **The auditor** later wants every number accounted for and every signature attributable.

**Outcome and proof.** A requester raises a requisition in under a minute on a phone. Each approver sees what waits on them, approves in two taps, and cannot approve their own request. Stores issues what is on the shelf and orders the rest from the same screen. Every signature on the printed form carries a name, a role, a date and time, and a pay number where the form asks for one. The register shows every number issued, cancelled ones included.

**Direction.** The visual authority is the Ledger Page (DESIGN.md), unchanged. The structural thesis is **the paper form's bottom row, made into a sign-off ledger**. Under the lines sits a ruled column of sign-offs in the form's order:

1. Requisitioned
2. Foreman
3. Divisional Head
4. Over limit (only when the value requires it)
5. Stores verified
6. Received

Each row holds the person, the role, the time and the decision. The row waiting now carries the 1px teal left marker, and only the person whose turn it is sees the buttons. The screen is the record. The printout is the same record laid out as the council's paper form.

**Scope and boundaries.**

- *In scope:*
  - raising, approving, issuing from stock, converting to purchase orders, receiving;
  - the printed form;
  - the register and approval queue;
  - settings: departments and their approvers, value limits, the vote list, numbering;
  - issues to a vote included in the council's nightly journal.
- *Untouched:*
  - purchasing for the Workshop and Full workshop plans, which continue to order directly;
  - job card processing, except where issued parts reach a job card (§6.4).
- *Anti-goals:*
  - no tendering or bid evaluation inside MOTION; procurement above small value stays with the council's procurement unit;
  - no hard-coded Namibian thresholds;
  - no drawn signatures by default;
  - no second approval engine beside the one built here.

**States and ranges.** Typically 1–5 lines per requisition, at most about 30. Values run from N$ 50 to N$ 500,000. The material states:

- draft; submitted and waiting on a named person;
- returned for changes; rejected with a reason;
- approved and waiting on stores;
- part issued; on order; received; closed; cancelled (number kept).

Empty states state facts:
- "No requisitions are waiting on you."
- "No department has an approver yet. An owner sets them in Settings."

## 5. How it works

### 5.1 States

```
Draft ──submit──► Awaiting Foreman ──► Awaiting Divisional Head ──► [Awaiting over-limit approver]
                       │ return/reject        │ return/reject               │ return/reject
                       ▼                      ▼                             ▼
                  Returned (editable, approvals cleared)   Rejected (closed, reason kept)

Approved ──► stores: issue from stock and/or order the rest
         ──► Part issued / On order ──► Received (every line issued and signed for) ──► Closed
Any open state ──cancel (reason)──► Cancelled (number kept)
```

**Rules.**

- **Separation of duties.**
  - Nobody approves a requisition they raised.
  - Nobody signs two approval steps on the same requisition.
  - The storeman who issues cannot be the receiver.
- **Editing after submission returns it to the start.** A change to lines, quantities or the charge code returns it to Draft and clears the approvals. Approval covers what was approved, not what it later became.
- **The over-limit step appears only when needed.** It is added when the requisition's value is at or above the council's limit. The value is checked again when it becomes a purchase order: if the order exceeds the approved value by more than the tolerance (§8), it needs approval again.
- **A number is issued once.** The number is issued on submit, and a cancelled requisition keeps it.
- **On a council, every purchase order traces to an approved requisition.**

### 5.2 Who signs

- **Departments.** A setting lists departments. Each department has one or more Foremen and a Divisional Head, each with optional deputies for leave.
- **A foreman's own requisition.** When the requester is a foreman of that department, another of its foremen (or a deputy) signs the foreman step. If there is none, the step is recorded as "Raised by the foreman" and the requisition goes straight to the Divisional Head. This is an assumption to confirm with the council.
- **Value limits.** A setting holds one value limit, excluding VAT, and the person or people who approve above it. Further tiers are an open decision.
- **The over-limit approver** may be a MOTION user without workshop duties, such as procurement. They get a role that can see and sign requisitions and nothing else.
- **Pay numbers.** Each team member has a pay number, added to the team settings.
- **Receivers without a login.** The receiver may not be a MOTION user. Stores records their name and pay number, and the printout leaves a signature line for the wet signature.

### 5.3 Fulfilment

- **Issue from stock.** Stores enters quantities per line, sees what is on hand, and names the receiver. Each issue is a stock movement of a new kind, `ISSUE`, linked to the requisition line.
- **Issued parts on a job card.**
  - When the charge is a job card, the issued parts appear on that job card at cost.
  - They are marked as already issued, so processing the job card does not move the stock a second time.
  - This is the one change inside job cards.
- **Issued to a vote.** When the charge is a vote, the issue is a cost to that vote. It is included in the council's nightly journal as an expense to the vote and a reduction of stock.
- **Order the rest.** This creates one purchase order per supplier from the lines stores could not issue. Each order line is linked back to its requisition line.
- **Goods that arrive** on a supplier invoice go onto the shelf as today, and are then issued to the requester with the same receiver step. A non-stock item can be issued straight on arrival.

### 5.4 Notifications

- The next person to sign receives an email.
- The dashboard's "Needs attention" shows "Requisitions waiting on you".
- The requester is told when the requisition is approved, returned or rejected, and when the goods are ready to collect.

## 6. Screens

1. **Purchasing › Requisitions (list).**
   - Approvers open on "Waiting on you"; others open on their own.
   - Filters: Waiting on you, Mine, Open, On order, Closed, Cancelled.
   - Columns: number, date, department, requested by, charge to, value, state, waiting on (a name, not a role).
   - It becomes stacked cards on a phone.
2. **A requisition.**
   - The header holds number, state, department, location, charge to and required by.
   - The lines grid shows item code, description, quantity, rate, value, on hand, issued and ordered.
   - The sign-off ledger sits below (§4, Direction).
   - Actions belong to the current step: Submit for the requester; Approve, Return or Reject for the Foreman, the Divisional Head or the over-limit approver; Issue and Order the rest for stores; Print.
3. **Raise on a phone.**
   - One column: search a stock item or type one, set the quantity, choose the job or vote, then submit.
   - The submit button sits above the tab bar.
4. **Approve on a phone.** The lines, the total, the charge code and the trail, with Approve and Return or Reject, each with an optional comment. Rejecting requires a reason.
5. **The issue dialog.** Quantities per line against stock on hand, the receiver (a team member, or a name and pay number), and a confirmation that names what leaves the shelf and what it is charged to.
6. **The printed form (PDF).**
   - Laid out like the paper: number top right; department and room; lines with Item No., Articles, Quantity, Rates, Value and Inventory; Job or Vote No.
   - Three sign-off blocks completed with name, date and pay number, plus "Approved in MOTION at 14:32".
   - A signature line for the receiver.
7. **Settings › Requisitions.**
   - Departments and their approvers.
   - Value limit and its approver.
   - The vote list: CSV import and the code format.
   - Numbering prefix.
   - "Orders need an approved requisition", on and locked for councils.
8. **Reports.**
   - The requisition register: every number, including cancelled ones, which becomes part of the council audit pack.
   - Open requisitions by age.
   - Spend by vote.
   - Issues by department.

## 7. Building it (proposed pull requests)

1. **Foundations.**
   - The data model:
     - requisition, lines and sign-offs;
     - departments and their approvers;
     - the vote list;
     - the pay number on a team member;
     - the `ISSUE` stock movement;
     - the `REQUISITION` number series.
   - Row-level security on every new table.
   - The rules as pure functions:
     - state machine;
     - who signs next;
     - separation of duties;
     - the value limit;
     - re-approval on change.
   - Database tests: gap-free numbering, one tenant cannot reach another's requisitions, and nobody approves their own.
2. **Raise and approve.** The list, the requisition page, the sign-off ledger, the phone forms, approval emails, the dashboard queue, and settings for departments, approvers and limits.
3. **Fulfil.** Issue from stock with the receiver and pay number; issued parts on job cards without double movement; vote charges in the nightly journal; order the rest; the gate on purchase orders.
4. **Print and report.** The PDF form, the register in the audit pack, open-by-age, spend by vote.
5. **Help and proof.**
   - Help topics written as the questions people ask:
     - "Who approves my requisition?"
     - "Why can't I order without a requisition?"
     - "How do I issue parts to a job?"
   - The staff guide.
   - An end-to-end test from raising to issue on a job card.
   - axe coverage of the new screens.

## 8. Open decisions (not to be invented by whoever builds it)

1. **A foreman's own requisition** (§5.2). Who signs the foreman step when the requester is the department's only foreman.
2. **Value limits.**
   - The amount, or amounts if there are tiers.
   - Whether it is measured including or excluding VAT.
   - Who approves above it: procurement officer, accounting officer or CEO.
   - The tolerance before a dearer purchase order needs approval again.
3. **The vote list.** Its source (the council's ERP), its format (the example looks like 13 digits), and who keeps it current. One code per requisition is decided.
4. **Breakdowns after hours.** Whether stores may issue before approval, with sign-off afterwards and the requisition marked as retrospective. Councils usually have such a provision; it needs their wording.
5. **Departments.** Only the workshop's own sections, or every council department that draws supplies through the workshop's stores (the example appears to be PPE).
6. **Quotations.** Whether MOTION records the quotations obtained for a purchase, attached to the order, or leaves that entirely with the procurement unit.

## Sources

- [Public Procurement Act 15 of 2015 (Legal Assistance Centre)](https://www.lac.org.na/laws/2015/5922.pdf)
- [Public Procurement Regulations, 2017 (NamibLII)](https://namiblii.org/akn/na/act/gn/2017/47/eng@2018-04-20)
- [Commentary on GN 259 of 2026 (The Brief)](https://thebrief.com.na/2026/08/namibia-streamlines-public-procurement-what-the-new-regulations-mean-for-government-and-business/)
- [Nquthu Municipality, Inventory and Stores Management Policy](https://nquthu.gov.za/Documents/FINANCE%20POLICIES/Inventory%20%20and%20Stores%20Management%20Policy%202026-27.pdf)
- [Indian Railways stores code: a combined requisition and issue note](https://indianrailways.gov.in/railwayboard/uploads/codesmanual/StoreDept-II/StoreDeptII_Ch13_data.htm)
- [Parts issue slips signed against a service order](https://kaizen-wiki.pages.dev/modules/p1_master_data/Parts_Inventory)
- [Job card approval before stores issues parts](https://sites.google.com/quickeasysoftware.com/bumatech/processes/maintenance-job-cards)
