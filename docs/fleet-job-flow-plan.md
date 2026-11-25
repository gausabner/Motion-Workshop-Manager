# Fleet job flow: brief and plan

> **Status, 25 November 2026: built and live.** The route, the check bay and the job card's signatures shipped in parts 1–5 (#38–#45). Since then:
> - **Workshop staff and assignment (#52):** each workshop and bay has staff (mechanic, artisan, intern); once a place accepts a vehicle its foreman, a deputy or an administrator puts staff on the job; the first still on it is the lead and the job card's Mechanic. Appointments and staff can be replaced in one step.
> - **Notifications (#54):** a vehicle sent on tells the people at the place it is going (reception's people, the check bay's foremen, a workshop's foremen, deputies and staff); a person put on a job is told.
> - **The floor app (#56–#61):** assigned people see the job, its place on the route, its sheet (work, findings, parts, crew, time against the estimate) and can tell the foreman "my part is done".
> - Copy says *organisation*, not council (#51). The walkthrough of one job is at https://claude.ai/artifact/DfcvL47UbygC2bAbTBM8sh; the design decisions are ADR-002 and ADR-004 in [architecture.md](architecture.md).

Shaped on 19 November 2026 from the owner's brief "Job Card Flow", and widened
the same day by the owner's note on divisions, departments and vote numbers
(§6). Its companion is `requisitions-plan.md`, which this plan revises where the
two meet (§5). Nothing here is built yet.

## 1. The flow, as the owner described it

1. A vehicle breaks down or is due a service.
2. The driver, owner or customer books it in at Reception.
3. A job card is issued. Reception, a mechanic or a service advisor may issue
   it. It is signed by reception, the driver, the foreman, the fleet
   coordinator and the mechanic. The vehicle goes to the Check bay.
4. The Check bay inspects it and assesses the work, from the driver's report or
   the service that is due.
5. It goes to a workshop that can do the work. A council or company has some or
   all of these:
   - light vehicles workshop;
   - light and medium vehicles workshop;
   - heavy duty vehicles workshop;
   - check bay;
   - service bay;
   - manufacturing and engineering workshop;
   - tyre bay;
   - carwash.
6. While the work is under way, its status is tracked until it is complete.
7. Back at the Check bay, a second inspection confirms that nothing new is
   damaged and that the job card's work was done properly.
8. The vehicle goes to Reception, where it is ready for the driver to collect.

**Parts during the job.**

- If stores has the part, a requisition books it out of stores.
- If stores does not have it, a requisition for the part is submitted with a
  quotation for approval. Parts drivers, or staff with that designation, take
  the requisition to suppliers for quotes. MOTION can also email it to
  suppliers.
- When the part is received, the requisition is signed and finalised by the
  Division Head, Fleet Coordinator, Foreman, Artisan, Mechanic and/or Intern.

## 2. Decisions (19 November 2026)

- **Council plan only.** Councils and company fleets get the bays, the
  handovers and the sign-offs. Private garages keep today's job card unchanged.
- **Two linked requisitions when stores falls short.** A *stores requisition*
  covers what is on the shelf. A separate *purchase requisition*, carrying its
  quotations, covers what must be bought. Each has its own number, and the
  purchase requisition names the stores requisition it came from.
- **Quotations by value, set by the council.** For example, one quotation
  below a figure and three above it, to match the council's procurement
  policy. MOTION holds no figure of its own. *(November 2026: a South African
  municipality needs three written quotations for anything over R2,000, so
  its bands start there; see [compliance-check-2026-11.md](compliance-check-2026-11.md).)*
- **Finalising a received requisition always needs the Foreman, the Fleet
  Coordinator and the Division Head.** The person who fitted the part
  (mechanic, artisan or intern) signs when present; their signature is
  optional.
- **The routing after assessment** is done by the check bay or the foreman,
  whichever acts first.
- **Cost centres and votes are a paid add-on** for organisations that need them
  (§6). It is priced by fleet size: bands of vehicles registered to votes.
- **The workshop's own chain approves spend charged to another division's
  vote:** its foreman and its division head. The **fleet coordinator of the
  division that owns the vote** is notified. They may approve the cost against
  their vote, or sign that they have witnessed it.
- **Charge-back is cost plus a markup.** Labour is charged at an internal
  hourly rate, parts at cost plus a council-set markup, and sublet work at
  cost.
- **Budgets stay in the finance system.** MOTION reports what is committed and
  what is spent against each vote. It does not hold budgets or refuse spend
  against them.

## 3. Readings to confirm

These were stated back to the owner on 19 November 2026 and not corrected.
Each needs the council's own paperwork before it is built.

- **Issuing the job card takes all five signatures:** reception, driver,
  foreman, fleet coordinator and mechanic. The driver usually has no MOTION
  login, so they are recorded by name and pay number and sign the printout,
  like a requisition's receiver.
- **A job can visit more than one workshop,** for example heavy duty, then the
  tyre bay, then the carwash.
- **Two lists, not one** (§4.2). The *organisation* (divisions, departments
  and their votes) owns the vehicles and pays. The *workshop* (workshops and
  bays) is where a vehicle is.
- **Fleet coordinators belong to the owning division.** The fleet coordinator
  who signs a job card at issue, and who finalises a requisition, is the
  coordinator of the division that owns the vehicle.
- **Designations are separate from roles.** A role decides what somebody can
  do in MOTION. A designation is the job title a signature is given under.

## 4. How it fits MOTION

MOTION already has these:

- A job card is a document with a job number and a progress status:
  - booked in;
  - work in progress;
  - waiting for parts;
  - inspection in progress;
  - waiting for approval;
  - job complete;
  - finalised.
- Every change of status is logged with who made it and when.
- Inspections attach to a job card.
- Vehicles carry a fleet number.
- Mechanics clock on and off from the floor app.

The new flow adds **a second track: where the vehicle is.** Progress (the
existing status) and place are different questions. "Waiting for parts" and
"in the heavy duty workshop" are both true at once.

### 4.1 Designations

Each team member carries any of these designations:

- Reception
- Foreman
- Fleet Coordinator
- Mechanic
- Artisan
- Intern
- Parts Driver
- Storeman
- Division Head

Sign-offs and assignments use designations. An artisan and a mechanic can
therefore share the Mechanic role and still sign as themselves. Pay numbers
(`Membership.payNumber`, already in the requisitions model) appear beside every
signature.

### 4.2 Two lists: the organisation, and the workshop

**The organisation** owns the vehicles and pays for them. It is one or two
levels deep, and the council names the levels, because organisations differ:

- the owner's council runs Divisions, with Departments under them;
- the City of Windhoek runs Departments, with Divisions under them;
- central government runs Votes, then main divisions, then subdivisions.

Votes (cost centres) sit at the lowest level, with each code kept exactly as
the council's finance system writes it. Each division carries its division
head and its fleet coordinators. The paper requisition's "Dept." is a place in
this list.

**The workshop** is where a vehicle is. It lists the workshops and bays the
council has, each with a **kind** and its foremen:

| Kind | Examples |
| --- | --- |
| Reception | Reception |
| Check bay | Check bay |
| Workshop | Light vehicles; light and medium; heavy duty; manufacturing and engineering |
| Bay | Service bay; tyre bay; carwash |

A council switches on the ones it has. A part asked for during a job is
requested by the workshop the vehicle is in. The workshop itself belongs to a
division of the organisation, usually the one that runs the fleet, and that
division's head is the "Divisional Head" who approves the workshop's
requisitions.

### 4.3 The vehicle's route

The route is a list of **visits**, each one a stay in one department:

1. Reception: booked in.
2. Check bay: assessment.
3. One or more workshops or bays: the work.
4. Check bay: quality check.
5. Reception: ready for collection.
6. Collected.

**What each visit records.**

- *Arriving.* The time, who handed the vehicle over, and who received it.
- *Leaving.* The time it left.
- *Where it went next.*

The open visit is where the vehicle is now. Closed visits give the time spent
in each bay, and the turnaround from booking in to collection.

**Moving a vehicle** is a handover. The person sending it chooses the next
department. The receiving department accepts it, which records who received
it. After the assessment, the check bay's inspector **or** the foreman may send
the vehicle to a workshop. Whichever acts first does it, and the handover
records who did (decided 19 November 2026).

**Gates.**

- Nothing leaves the Check bay for a workshop until its assessment is
  complete.
- Nothing reaches Reception for collection until the quality check has passed.

**A failed quality check** sends the vehicle back to the workshop that did the
work, as a new visit. The failure is recorded on the job card.

### 4.4 Signatures on the job card

Job card signatures work like requisition signatures: a trail of signatures,
each with a name, designation, pay number, time and comment, copied at the
moment of signing.

- **At issue:** reception, driver, foreman, fleet coordinator and mechanic.
- **At the quality check:** the check bay's inspector.
- **At collection:** the driver, by name and pay number, plus reception.

The printed job card carries every signature, with blank lines for the
signatures that are made on paper.

### 4.5 The check bay's two inspections

Both check bay inspections use MOTION's existing inspections, with a purpose:

- **Assessment.** Based on the driver's report or the service that is due. Its
  findings become the job card's work.
- **Quality check.** No new damage, and the job card's work done.

A failed item on the quality check returns the vehicle to the workshop
(§4.3).

### 4.6 Status within the work

The existing statuses continue while the vehicle is in a workshop:

- work in progress;
- waiting for parts;
- job complete.

"Waiting for parts" is set automatically while a requisition for the job is
open, and cleared when it is finalised or issued.

## 5. What this changes in the requisitions plan

The requisitions plan's PR 1 (#38) is not merged or deployed. It is revised
before merge rather than patched afterwards.

1. **Two kinds of requisition.**
   - A *stores requisition* is issued from stock.
   - A *purchase requisition* is bought from a supplier.

   A purchase requisition may name the stores requisition it came from. Stores
   splits a stores requisition it cannot fully meet, and the missing lines
   become a new, numbered purchase requisition.
2. **Raised from the job.** A requisition raised on a job card comes from the
   workshop the vehicle is in, and is charged to that job. With the add-on
   (§6), that means it is charged to the vehicle's vote.
3. **Quotations (purchase only).**
   - **What a quotation records:**
     - the supplier;
     - the amount, excluding VAT;
     - its reference;
     - the date it is valid until;
     - the scanned quote;
     - who obtained it, normally a Parts Driver.
   - **Submitting.** A purchase requisition cannot be submitted until it
     carries the number of quotations the council's rule requires for its
     value.
   - **Choosing.** The approvers approve one chosen quotation, and its supplier
     and amount become the purchase order.
4. **Asking suppliers by email.**
   - A request for quotation is built from the requisition's lines, without
     prices.
   - It is sent through MOTION's usual hand-off: an email with a share link to
     the request, to each supplier chosen.
   - The supplier replies with a quotation, and the parts driver attaches it.
5. **The approval chain** stays as decided: Foreman, then Division Head, then
   the council's over-limit approver above its limit. It is the same for both
   kinds.
6. **Finalising on receipt.**
   - After a stores issue or a purchased part's arrival, the requisition is
     finalised.
   - **Always required:** Foreman, Fleet Coordinator and Division Head.
   - **Optional:** the mechanic, artisan or intern who fitted it.
   - **Receiver:** the receiver's name and pay number are still recorded on
     each handover from stores.

## 6. Cost centres and votes (paid add-on)

### 6.1 What the research shows

- **The levels have different names from one organisation to the next**
  (§4.2). The vote is the constant: the budget line a cost is charged to,
  numbered by the finance system.
- **Votes are a hard control in law.** For example, Walvis Bay's financial
  rules allow no capital vote to be exceeded without the Minister's written
  consent. The owner has decided that budgets stay in the finance system
  (§2), so MOTION's part is to make every cost traceable to its vote and to
  report it promptly.
- **Fleet workshops charge back to the departments that own the vehicles.**
  Each job is charged for its labour, parts and sublet work. Public fleet
  audits stress the same point: a cost can only be recovered if it can be
  traced to the vehicle and its vote.

### 6.2 What the add-on adds

1. **Vehicles registered to a vote.** Each vehicle carries its owning vote,
   and through the vote its department and division. Councils can import the
   register by CSV with each vehicle's fleet number and vote code.
2. **Charging follows automatically.** These are charged to the vehicle's vote
   without anyone typing a code:
   - every job card;
   - every requisition raised on a job;
   - every part issued to the job.

   A requisition not raised on a vehicle (safety gear, consumables) is charged
   to a vote chosen on the requisition, as on the paper form.
3. **Charge-back at cost plus a markup.**
   - **Labour:** at the council's internal hourly rate.
   - **Parts:** at cost plus the council's markup percentage.
   - **Sublet work:** at cost.

   The rates in force when a job is finalised are copied onto it, as tax is
   copied onto a document, so a later change of rate does not rewrite a past
   charge.
4. **The payer is told, and may sign.**
   - When a requisition charged to a vote is approved, that division's fleet
     coordinator is notified.
   - They may record "Approved against the vote" or "Witnessed". Either
     signature joins the requisition's trail.
   - Neither holds the requisition up. The workshop's foreman and division head
     remain the approvers.
5. **Recharge statements.**
   - A monthly statement for each vote, department and division.
   - Each statement lists every job and requisition charged: labour, parts with
     markup, sublet work and totals.
   - The same lines go into the council's existing nightly journal, coded by
     vote, so the finance system posts them without retyping.
6. **Tracking, not budgets.** For each vote MOTION reports:
   - *committed:* approved requisitions and purchase orders not yet received;
   - *spent:* parts issued, labour and sublet work on finalised jobs.

   Budgets, and any refusal to exceed them, stay in the finance system.
7. **Reports.**
   - Cost per vehicle, per vote, per department and per division.
   - Committed against spent, by vote.
   - Cost per kilometre, from odometer readings on job cards.
   - The vehicles costing most to keep.

### 6.3 Without the add-on

A council on the plan without the add-on keeps a flat list of departments, and
types vote numbers onto requisitions as the paper form does. Approval steps,
numbering and printing work the same. Nothing is charged automatically, rolled
up, or recharged.

### 6.4 Selling it

The add-on is priced by **fleet size**, in bands of vehicles registered to
votes, on the council's quote alongside the per-site price. The band edges
and prices are the owner's to set (§9).

MOTION's plans today are three tiers of features. An add-on is new. It is
recorded on the workshop's subscription, switched on by MOTION staff once
quoted and paid, and checked by the same plan gate as every feature: in the
navigation, the pages, the actions and the database layer. The fleet size it
was priced for is recorded with it, and the vehicle register shows when a
council has grown past its band.

### 6.5 What it changes in the model

Nothing is merged yet, so these are revisions rather than additions:

- **`Department` (#38) splits in two:**
  - the *organisation*: units in a tree, each level named by the council, with
    votes at the lowest level;
  - the *workshop*: workshops and bays with their kinds.
- **The organisation's people.** Division heads and fleet coordinators are
  assigned to the organisation. Foremen are assigned to workshops and bays.
- **`Vote`** belongs to an organisation unit.
- **`Vehicle`** gains its owning vote (add-on only).
- **Copied onto each finalised job:** the charge-back rates and the vote.

## 7. Screens

All of these use the Ledger Page system (DESIGN.md). They are council plan
only, and shown locked on other plans.

1. **Reception board.**
   - Vehicles booked in and waiting for the check bay.
   - Vehicles back from the quality check and ready for collection, with how
     long each has waited.
   - Collecting a vehicle records the driver's name and pay number.
2. **A board for each department.**
   - The vehicles there now, with their time in the bay and their status.
   - Vehicles handed over and waiting to be accepted.
   - Each foreman's default view.
3. **The job card's route.** A ruled timeline of visits beside the existing job
   card: each department, who handed over and received, time in, and time
   spent. The signature trail sits below it, in the same form as the
   requisition's.
4. **The check bay.**
   - Assessments and quality checks waiting.
   - The inspection screen marked with its purpose.
   - Pass or return-to-workshop at the end of a quality check.
5. **Requisitions on the job card.**
   - "Request parts" opens a requisition already charged to the job.
   - The job shows its requisitions and their state.
6. **The parts driver's list.**
   - Purchase requisitions needing quotations, and how many each still needs.
   - Send a request for quotation.
   - Attach a quotation received.
7. **Settings.**
   - The organisation: levels, units, votes, heads and fleet coordinators.
   - Workshops and bays, with their kinds and foremen.
   - Designations on the team screen.
   - The quotation rule by value.
   - Which signatures the council's paper job card needs.
   - With the add-on: the internal labour rate and the parts markup.
8. **Printing.**
   - The job card with its route and signatures.
   - The requisition form.
   - The request for quotation.
9. **Reports.**
   - Turnaround from booking in to collection.
   - Time in each bay.
   - Vehicles waiting for parts, by requisition and age.
   - Quality-check returns by workshop.
10. **With the add-on.**
    - The vehicle register by vote.
    - Each vehicle's owning vote on its page and on every job card.
    - The fleet coordinator's list of requisitions to approve against the vote
      or witness.
    - Recharge statements.
    - The cost reports in §6.2.

## 8. Building it (revised order for both plans)

1. **Foundations, revised (#38).**
   - Requisition kinds and the link between them.
   - Quotations, and the quotation rule.
   - Designations.
   - The organisation tree with votes, and the workshop with its kinds.
   - Finalising signatures, including the payer's "approved against the vote"
     or "witnessed".
   - Rules and database tests for all of it.
2. **Settings.**
   - The organisation and the workshop, with their people.
   - Designations and pay numbers on the team screen.
   - The vote list, with CSV import.
   - The quotation rule.
3. **The route.**
   - Visits and handovers.
   - Signatures at issue, quality check and collection.
   - The reception board and department boards.
   - The route on the job card.
4. **The check bay.**
   - Assessment and quality check on the existing inspections.
   - The gates.
   - Return to workshop.
5. **Stores requisitions.**
   - Raised from the job card.
   - Approval.
   - Issue with the receiver's pay number.
   - Parts on the job card without moving stock twice.
   - "Waiting for parts" kept in step.
   - Finalising.
6. **Purchase requisitions.**
   - Splitting from a stores requisition.
   - The parts driver's list.
   - Quotations and their rule.
   - Requests for quotation by email.
   - Approval of the chosen quotation.
   - Purchase order, receipt and finalising.
7. **Print, reports and proof.**
   - The printed job card, requisition and request for quotation.
   - The reports in §7.
   - Help topics written as questions people ask.
   - End-to-end tests:
     - from booking in to collection;
     - from a requisition to a part fitted.
8. **The cost-centre add-on.**
   - Add-ons on the subscription, behind the plan gate.
   - Vehicles registered to votes, with CSV import.
   - Automatic charging, and charge-back rates copied onto finalised jobs.
   - The fleet coordinator's notice and signature.
   - Recharge statements, and vote-coded journal lines.
   - The cost reports.
   - Fleet size against the priced band.

## 9. Open decisions (not to be invented by whoever builds it)

1. **The council's paper job card.** A photo of it, like the requisition form,
   to confirm the five signatures, when each is made, and what else the card
   carries.
2. **The driver register.** Whether councils want a list of their drivers with
   pay numbers to pick from at reception, or type them each time.
3. **The quotation rule's figures.** The council's own value bands and quotation
   counts.
4. **After-hours breakdowns.** Whether parts may be booked out before approval,
   with the signatures afterwards (carried over from the requisitions plan).
5. **Quality-check failures.** Whether a failure always returns the vehicle to
   the workshop that did the work, or the check bay chooses.
6. **The add-on's bands and prices.** Where the fleet-size bands break, and the
   price of each.
7. **Charge-back figures.** Each council's internal labour rate and parts
   markup, and whether consumables carry the markup.
8. **The vote code format.** Whether MOTION should check each council's code
   structure (the owner's example has 13 digits), or keep codes exactly as
   imported.
9. **Recharge statements.** Whether they go to the department by email from
   MOTION, or only into the journal and the reports.

## Sources (cost centres and votes)

- [City of Windhoek: the Finance department and its divisions, Fleet Management among them](https://windhoekcc.org.na/depa_finance.php)
- [City of Windhoek: its nine departments](https://windhoekcc.org.na/coun_mayor_office.php)
- [Ministry of Finance, Namibia: the budget presented by votes, main divisions and subdivisions](https://www.sipri.org/sites/default/files/2024-04/20230300_mof-nam_final_budget_for_2023.pdf)
- [Vote 24, Transport (Parliament of Namibia)](https://www.parliament.na/wp-content/uploads/2025/05/VOTE-24-Transport.pdf)
- [Walvis Bay financial rules, 1997: no capital vote exceeded without the Minister's consent](https://www.saflii.org/na/other/NAGovGaz/1997/255.txt)
- [Mangaung: vote and sub-vote schedule, including Fleet Services Administration](https://www.mangaung.co.za/wp-content/uploads/2023/06/A1-Schedule-mSCOA-vs-67-20-April-2023PROTECTED_CONS_202223_20230607_2022.pdf)
- [mSCOA regulations (National Treasury, South Africa)](https://mfma.treasury.gov.za/RegulationsAndGazettes/MunicipalRegulationsOnAStandardChartOfAccountsFinal/)
- [Commitment control in purchasing (Oracle PeopleSoft)](https://docs.oracle.com/en/applications/peoplesoft/financials-and-supply-chain-management/9.2.056/peoplesoft-purchasing/understanding-commitment-control-peoplesoft-purchasing.html)
- [Montgomery County: the fleet budget charged back to departments](https://www.montgomerycountymd.gov/council/Resources/Files/agenda/col/2022/20220511/20220511_6.pdf)
- [Fort Worth: fleet maintenance audit](https://www.fortworthtexas.gov/files/assets/public/internal-audit/documents/archived/2017-10-20-fleet-maintenance-audit.pdf)
- [Hillsborough County: fleet maintenance cost recovery policy](https://hcfl.gov/policies/board-policy---section-number-03-02-02-12)
