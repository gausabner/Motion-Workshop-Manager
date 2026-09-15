/** A row in a searchable picker: what to show, and what identifies it. */
export type PickerHit = { id: string; label: string; sublabel?: string | null };

/** A vehicle carries its owner, so choosing one can fill in the customer. */
export type VehicleHit = PickerHit & { customerId: string | null; ownerLabel: string | null };

export type QuickCreateResult<T> =
    | { ok: true; hit: T }
    | { ok: false; message?: string; errors?: Record<string, string[] | undefined> };
