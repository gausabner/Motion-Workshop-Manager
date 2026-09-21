export interface Customer {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    fax: string | null;
    biller: string | null;

    // Status
    is_active: boolean;
    is_cash: boolean;
    is_individual: boolean;
    is_non_biller: boolean;

    // Financial
    unapplied_credit: number;
    account_balance: number;
    hourly_rate: number | null;
    discount: number | null;
    markup: number | null;

    // Addresses
    street_address_1: string | null;
    street_address_2: string | null;
    street_suburb: string | null;
    street_state: string | null;
    street_postcode: string | null;

    postal_address_1: string | null;
    postal_address_2: string | null;
    postal_suburb: string | null;
    postal_state: string | null;
    postal_postcode: string | null;

    // Contact Preferences
    web: string | null;
    preferred_contact_method: string | null;
}
