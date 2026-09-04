export interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    biller?: string;
    businessNumber?: string;

    streetAddress1?: string;
    streetAddress2?: string;
    streetSuburb?: string;
    streetCity?: string;
    streetState?: string;
    streetCountry?: string;
    streetPostcode?: string;

    postalAddress1?: string;
    postalAddress2?: string;
    postalSuburb?: string;
    postalCity?: string;
    postalState?: string;
    postalCountry?: string;
    postalPostcode?: string;

    phone?: string;
    mobile?: string;
    email?: string;
    fax?: string;
    preferredContactMethod?: string;

    hourlyRate?: number;
    discountPercent?: number;
    markupPercent?: number;
    paymentTerms?: string;

    importedId?: string;
    governmentId?: string;
    amsMemberNumber?: string;
    capricornMemberNumber?: string;
}

export interface Vehicle {
    id: string;
    customerId?: string;
    registrationNumber: string;
    vin?: string;
    make: string;
    model: string;
    modelSeries?: string;
    engineNumber?: string;
    chassisNumber?: string;
    fleetCode?: string;

    transmission?: string;
    hasAc?: boolean;
    bodyType?: string;
    seating?: number;
    fuelType?: string;
    color?: string;
    buildDate?: string;
    tyreSize?: string;

    region?: string;
    city?: string;
    country?: string;

    regoDueDate?: string;
    wofDueDate?: string;
    odometer?: number;
    engineHours?: number;
    lastInDate?: string;
    lastServiceDate?: string;
    nextServiceDate?: string;
    nextServiceKm?: number;
    serviceIntervalMonths?: number;
}

export interface Supplier {
    id: string;
    companyName: string;
    website?: string;
    biller?: string;

    address?: string;
    address2?: string;
    street?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;

    phone?: string;
    mobile?: string;
    email?: string;
    fax?: string;

    vendorAccountNumber?: string;
    defaultPaymentTerms?: string;

    contact1First?: string;
    contact1Last?: string;
    contact1Position?: string;
    contact1Phone?: string;
    contact1Email?: string;

    contact2First?: string;
    contact2Last?: string;
    contact2Position?: string;
    contact2Phone?: string;
    contact2Email?: string;
}

export interface Product {
    id: string;
    itemCode: string;
    description: string;
    description2?: string;
    searchableTags?: string;

    group?: string;
    category?: string;
    brand?: string;
    type?: string;
    supplierId?: string;

    isService?: boolean;
    gstFree?: boolean;
    requiresSerialNumber?: boolean;

    quantityOnHand?: number;
    minimumQty?: number;
    maximumQty?: number;
    qtyReserved?: number;
    location?: string;

    costExcludingTax?: number;
    costIncludingTax?: number;
    retailPrice?: number;
    price1?: number;
    price2?: number;
    price3?: number;
    price4?: number;

    comment?: string;
    jobCardComment?: string;
}

export interface Booking {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;

    vehicleMake: string;
    vehicleModel: string;
    vehicleYear?: string;
    registrationNumber?: string;

    reference?: string;
    customerOrderNumber?: string;

    bookingDate?: string;
    scheduledDate: string;
    dueByDate?: string;

    serviceType: string;
    description?: string;
    eventNotes?: string;
    notes?: string;
    jobCardNotes?: string;

    status: string;
    assignedToId?: string;
}
