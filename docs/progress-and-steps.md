# Progress indicators, and where they actually belong

A survey of MOTION for journeys that would complete more often if the person
doing them could see how much was left — prompted by the password-reset
stepper, which is the first one built.

## The distinction that has to come first

Two different things get called "a progress bar", and building the second as
though it were the first is how an interface fills with decoration.

**A stepper** is for a journey somebody is completing *right now*, in a known
number of steps, where the risk is that they stop half way. Its job is to say
"three screens, you are on two". It is the one the research is about: a visible,
finite path raises completion because the alternative is an unknown number of
screens, and an unknown number always feels longer than it is. It only works
when the count is known in advance and the path does not go backwards.

**A status track** is for a long-lived record moving through states over days —
a car in the workshop, a purchase order, an inspection waiting on a customer.
The question it answers is "where is this?", not "how much is left for me to
do". It is valuable, but for a different reason, and it must be able to show a
state that is *not* forward motion.

The difference is load-bearing. A job card can go from
`WORK_IN_PROGRESS` to `WAITING_FOR_PARTS`, which is backwards. A bar that fills
up and then empties is worse than no bar: it reads as an error, and the first
thing a service advisor will do is ask whether the system has lost the job.

So: steppers below, then status tracks, then the places that should have
neither.

---

## 1. Steppers — journeys somebody completes in one sitting

### Online booking — the one to build first

`/[tenant]/book` already has four steps, named in its own source:

```
Step 1 — what needs doing.
Step 2 — which day.
Step 3 — what time.
Step 4 — who you are.
```

They exist in the code and are invisible on the screen. This is the strongest
candidate in the application, for four reasons that all point the same way:

- **The steps are already there.** `StepProgress` takes a list and a current id;
  this is an afternoon, not a project.
- **It is the only funnel with a stranger in it.** Everywhere else the person is
  already a customer or already an employee. Here they are a car owner who found
  the workshop online and can leave at no cost.
- **It is a phone, on mobile data, in Windhoek.** Four screens with no sense of
  how many remain is exactly the shape people abandon.
- **An abandoned booking is a lost job**, which is money, and nobody ever finds
  out it happened.

### Inspection, while a mechanic fills it in

`InspectionState` is `DRAFT → REQUESTED → APPROVED/REFUSED → FINALISED`, and the
filling-in part is a real sitting-down task: a list of items, each needing a
red/amber/green and sometimes a photo, done on a phone under a car.

What belongs here is not a four-step bar but a **count**: "11 of 24 checked". It
is the same idea — finite, visible, shrinking — and it is more honest than a
stepper because the work is one long step rather than four short ones.

### Stock take, while counting

`StockTakeState` is `DRAFT → APPLIED`, so as a stepper it is two boxes and
pointless. But a stock take is somebody in a store room with a phone counting a
few hundred lines, which is the longest uninterrupted task MOTION asks of
anyone. "143 of 380 counted" belongs at the top of that screen, and the number
is already known.

The same shape as the inspection, and worth building once rather than twice.

### Quote approval, on the customer's phone

The share-link approval flow is short — read, approve or query, done — but it is
a customer being asked to commit money on a phone. Two or three steps is thin
for a stepper; what it wants instead is the **outcome** made obvious, which is a
different fix and is noted here so it is not solved with the wrong tool.

---

## 2. Status tracks — records moving over days

These want a horizontal track with the current state marked, states behind it
dimmed, and **no claim about percentage**.

### The job card, which is the best one in the product

`JobStatus` has nine states:

```
BOOKED_IN → WORK_IN_PROGRESS → WAITING_FOR_PARTS → INSPECTION_IN_PROGRESS
→ WAITING_FOR_CUSTOMER_APPROVAL → JOB_COMPLETE → CUSTOMER_NOTIFIED
→ AWAITING_FINALISE → FINALISED
```

Two of those are *waiting* states, and that is the whole point. The question a
service advisor is asked twenty times a day — on the phone, by an owner standing
at the counter — is "where is my car". A track that can say **waiting on parts**
or **waiting on you** answers it without anybody reading a note.

So it must render a wait as a wait, not as 40% complete. A dimmed, amber-marked
node that says what is being waited on is worth more than any bar.

### The document chain, which is the product's own argument

`QUOTE → JOB_CARD → INVOICE → paid` is the landing page's whole illustration —
one document, never retyped. Inside the product a document does not show where
it sits in that chain.

Putting the same five-stage ribbon from the marketing page onto the document
itself would be the rare case where the sales story and the interface are
literally the same drawing. That is worth something beyond usability.

### Purchase orders

`SUGGESTED → ORDERED → RECEIVED` is three honest states and a natural track.
Low effort, modest payoff — it matters to one person at a parts counter rather
than to a customer.

---

## 3. Where not to put one

Worth writing down, because the failure mode of a good pattern is using it
everywhere:

- **Any two-field form.** Sign-in does not need a stepper.
- **Anything instant.** A progress indicator on something that completes in
  200 ms is a flicker that makes the app feel slower, not faster.
- **The dashboard.** It already has `SetupChecklist`, which is the right pattern
  for onboarding — a checklist with a real `role="progressbar"`, which
  disappears by itself when the workshop is ready. Adding a second progress
  device beside it would compete with it.

---

## What to build, in order

| | Why it is first |
| --- | --- |
| 1. **Online booking stepper** | The steps already exist in the code; the only funnel containing a stranger; an abandonment nobody ever learns about |
| 2. **Job status track** | The most-asked question in a workshop, and the one place a waiting state is the answer |
| 3. **Counted progress** for inspections and stock takes | One component, two long tasks, both done on a phone away from a desk |
| 4. **Document chain on the document** | The sales story and the interface become the same drawing |
| 5. **Purchase orders** | Cheap, narrow audience |

## What already exists, and should be reused rather than re-made

- `components/auth/StepProgress.tsx` — the bar and, more importantly, the
  accessibility: an `<ol>`, `aria-current="step"` on the live one, and an
  `sr-only` "step 2 of 3, current". It was extracted from the reset flow when
  registration needed the same thing. Anything in §1 should use it; two
  implementations of those semantics will drift until one is wrong.
- `components/setup/SetupChecklist.tsx` — the onboarding checklist, with
  `role="progressbar"` and correct `aria-valuenow`/`aria-valuemax`.

A counted indicator ("143 of 380") is a third shape and does not exist yet. It
should be built once, used by both §1 tasks, and carry the same semantics.

## One caution about the research

The finding that visible progress raises completion is real, and it is about
**journeys with an end the user is trying to reach**. It does not transfer to
status display, and it does not mean more indicators are better. Each one added
to a screen that did not need it spends attention that the next one will want.

The test for any of these: *if this were removed, would somebody have to ask a
question they can currently answer by looking?* Booking, the job card and the
counted tasks pass that. Most other screens do not.
