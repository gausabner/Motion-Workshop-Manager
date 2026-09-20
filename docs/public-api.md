# The MOTION public API

For anything outside MOTION that needs a workshop's data: the workshop's own
website, a reporting tool, a spreadsheet somebody keeps, or whoever they hire to
build them something.

Base: `https://<host>/api/v1` · JSON in, JSON out · version `v1`.

---

## 1. The key is the tenant

```
Authorization: Bearer mk_live_7Qa3…
```

That header is the whole of authentication. There is no slug in any path and no
session cookie, because the key already says which workshop it opens. A key
carries `READ`, or `READ` and `WRITE`.

Keys are made at **Settings → API keys** by an owner. The secret is shown once,
at the moment it is made: we store a salted hash of it, so nobody at MOTION can
read it back either. A lost key is revoked and replaced, never recovered.
Revoking keeps the row — a key that pulled a year of invoices is part of the
record of who saw what.

`GET /api/v1/ping` is the first call worth making:

```bash
curl -H "Authorization: Bearer $MOTION_KEY" https://example.com/api/v1/ping
```

```json
{
  "workshop": { "name": "Tip Top Auto", "currency": "NAD", "timezone": "Africa/Windhoek" },
  "scopes": ["READ"],
  "rateLimit": { "requests": 120, "perSeconds": 60 },
  "version": "v1"
}
```

---

## 2. Lists

Every list answers the same shape:

```json
{ "data": [ … ], "nextCursor": "cmu6poheu000hpadj87m6c78j" }
```

Page with `?limit=` (default 50, maximum 200) and feed `nextCursor` back as
`?cursor=`. When `nextCursor` is `null` you have everything. Paging runs on a
stable id order rather than an offset, so a record created mid-sync cannot make
a later page skip or repeat a row.

`?updatedSince=2026-09-01T00:00:00Z` on customers and products is what a
nightly sync should use: ask for what changed.

### Endpoints

| Call | What it answers |
|:--|:--|
| `GET /ping` | Whose workshop, what the key may do |
| `GET /customers` | Customers · `?updatedSince=` `?externalId=` `?includeArchived=true` |
| `GET /customers/{id}` | One customer, with their vehicles |
| `POST /customers` | Create a customer *(write)* |
| `GET /vehicles` | Vehicles · `?plate=` `?customerId=` `?externalId=` |
| `GET /vehicles/{id}` | One vehicle, with its last ten jobs |
| `POST /vehicles` | Create a vehicle *(write)* |
| `GET /products` | Price list and stock · `?itemCode=` `?q=` `?updatedSince=` |
| `GET /documents` | Quotes, bookings, job cards, invoices, credits · `?type=` `?state=` `?customerId=` `?vehicleId=` `?from=` `?to=` |
| `GET /documents/{id}` | One document with its lines |
| `GET /bookings` | Booking requests · `?status=PENDING` |
| `GET /bookings?slots={appointmentTypeId}` | When somebody could come in |
| `POST /bookings` | Ask for a booking *(write)* |

---

## 3. Money is a string

```json
{ "total": "1265.00", "taxTotal": "165.00", "paid": "500.00", "due": "765.00" }
```

JSON numbers are doubles, and a ledger read into a double and written back is
how cents go missing. Parse these with a decimal type, not a float.

Two things follow from how MOTION stores its books:

- **`paid` and `due` are computed on every read**, from payment allocations.
  They are never stored on the document, so they cannot go stale.
- **A credit note is the sale run backwards** — negative quantities, a negative
  total, a negative `due`. Do not flip the sign again when you sum.

Dates: a `postDate` or a `licenceExpiry` is a plain day (`"2026-09-20"`),
because that is what it is. Anything with a moment in it — `createdAt`,
`scheduledAt` — is a UTC timestamp. The workshop's own timezone comes back from
`/ping`; use it when you show a moment to a person.

---

## 4. Writes, and how to retry one safely

Send your own identifier as `externalId` on any create:

```bash
curl -X POST https://example.com/api/v1/bookings \
  -H "Authorization: Bearer $MOTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentTypeId": "cmtmy0e…",
    "day": "2026-09-22", "time": "08:30",
    "firstName": "Anna", "lastName": "Shilongo", "mobile": "081 555 6677",
    "plate": "N 777 WW", "vehicle": "2019 Toyota Hilux",
    "externalId": "web-form-48213"
  }'
```

Post it twice and the second answer is the same record with `"created": false`.
A website that times out and retries does not book the same person in twice.

Those identifiers live in a side table, not on the records. Workshop Software
carries about forty accounting-sync columns on the invoice alone — `qbo_id`,
`xero_sync_status`, `needs_myob_sync`, `needs_carfax_sync` — one set per
partner, widening a core table every time somebody integrates. Here the core
tables stay the shape of the business.

### A booking is a request

`POST /bookings` creates a *request*, in the same queue the public booking form
feeds, and somebody at the workshop confirms it. Capacity, working hours and
time off are checked at the moment you post, so ask for the open slots first
(`?slots=`) rather than guessing — a taken slot comes back `409 conflict`.
Once staff confirm, the request carries the new booking's `documentId`.

---

## 5. When something is wrong

```json
{ "error": { "code": "invalid_request", "message": "`type` must be one of QUOTE, BOOKING, JOB_CARD, INVOICE, CASH_SALE, CREDIT.", "field": "type" } }
```

| Code | Status | Means |
|:--|:--|:--|
| `unauthorized` | 401 | No key, a malformed key, or one that was revoked |
| `forbidden` | 403 | A read key tried to write |
| `not_found` | 404 | No such record **in this workshop** |
| `conflict` | 409 | The slot was taken while you were asking |
| `invalid_request` | 422 | Understood, but a value was wrong — see `field` |
| `rate_limited` | 429 | Over 120 requests in a minute; `Retry-After` says how long |
| `server_error` | 500 | Ours. Try again. |

The rate limit is counted on the key's own row, so every instance shares one
count and a retry cannot slip through a second server.

---

## 6. What this API will not do

- **No costs or margins.** A key that reads the price list does not hand out
  what the workshop paid.
- **No processing or settling.** Turning a job card into an invoice, taking
  money, voiding a document — those stay with a person who is signed in.
- **No wildcards in the path.** Theirs accepts `*` inside the URL as a filter;
  every read here is scoped to the key's tenant by the same layer that scopes
  the dashboard, so a key cannot ask a wider question than the workshop can.

---

## 7. Versioning

`v1` is in the path. Fields get added; published fields do not change meaning
or disappear inside a version. If one has to, it becomes `v2` and `v1` keeps
working while people move.
