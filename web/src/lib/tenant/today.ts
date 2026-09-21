/**
 * "Today" as the workshop reckons it.
 *
 * `postDate` and `dueDate` are `@db.Date` columns, and handing them a raw
 * `new Date()` stores the UTC calendar day. Namibia is UTC+2, so anything
 * captured after 22:00 UTC — which is any time from midnight local — would be
 * booked to the previous day, and a receipt dated to the wrong day is the sort
 * of thing an accountant finds and nobody can explain.
 *
 * Returns UTC midnight of the tenant's own calendar day, which is exactly what
 * a date column stores and what the ageing arithmetic compares against.
 */
export function businessToday(timezone: string, at: Date = new Date()): Date {
    // en-CA formats as YYYY-MM-DD, which is the shape a date column wants.
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
    return new Date(`${day}T00:00:00Z`);
}
