/** URL-safe workshop address from a name: "TipTop AutoCare & Sons" → "tiptop-autocare-and-sons". */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}
