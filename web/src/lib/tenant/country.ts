/**
 * What a new workshop starts with, by country — so nobody's first invoice goes
 * out on the wrong clock, in the wrong currency, at the wrong VAT rate.
 * Everything here stays editable in settings.
 */
export type CountryDefaults = { name: string; timezone: string; currency: string; locale: string; taxName: string; taxRate: number; dialPrefix: string };

export const COUNTRY_DEFAULTS: Record<string, CountryDefaults> = {
    NA: { name: "Namibia", timezone: "Africa/Windhoek", currency: "NAD", locale: "en-NA", taxName: "VAT", taxRate: 15, dialPrefix: "+264" },
    ZA: { name: "South Africa", timezone: "Africa/Johannesburg", currency: "ZAR", locale: "en-ZA", taxName: "VAT", taxRate: 15, dialPrefix: "+27" },
};

export const COUNTRIES = Object.keys(COUNTRY_DEFAULTS);

export function countryDefaults(code: string): CountryDefaults {
    return COUNTRY_DEFAULTS[code] ?? COUNTRY_DEFAULTS.NA;
}
