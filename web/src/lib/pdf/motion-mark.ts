import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Doc } from "@/lib/pdf/kit";

/**
 * MOTION's lockup, drawn into a PDF as vectors.
 *
 * Read from the same SVG the website uses (`public/brand/motion-lockup.svg`),
 * so a change to the brand reaches the invoices without anybody exporting a
 * PNG — and so the mark is sharp at any zoom, which a 270-pixel bitmap on an
 * A4 page is not. The file is nothing but filled paths in groups, which is
 * exactly what PDFKit's `path()` draws.
 *
 * If the file is missing or unreadable the invoice prints without it. A tax
 * invoice that cannot be produced because of a logo is not a trade worth
 * making.
 */

type Shape = { fill: string; d: string };
type Lockup = { width: number; height: number; shapes: Shape[] };

let cached: Lockup | null | undefined;

export function parseLockup(svg: string): Lockup | null {
    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!viewBox) return null;
    const shapes: Shape[] = [];
    for (const group of svg.matchAll(/<g\b[^>]*\bfill="(#[0-9a-fA-F]{3,8})"[^>]*>([\s\S]*?)<\/g>/g)) {
        for (const p of group[2].matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) shapes.push({ fill: group[1], d: p[1] });
    }
    return shapes.length ? { width: Number(viewBox[1]), height: Number(viewBox[2]), shapes } : null;
}

function lockup(): Lockup | null {
    if (cached !== undefined) return cached;
    try {
        cached = parseLockup(readFileSync(path.join(process.cwd(), "public", "brand", "motion-lockup.svg"), "utf8"));
    } catch {
        cached = null;
    }
    return cached;
}

/** Draws the lockup `width` points wide with its top-left at (x, y). Returns the height used — 0 if nothing was drawn. */
export function drawMotionLockup(doc: Doc, x: number, y: number, width: number, colour?: string): number {
    const mark = lockup();
    if (!mark) return 0;
    const scale = width / mark.width;
    doc.save();
    doc.translate(x, y).scale(scale);
    for (const shape of mark.shapes) doc.path(shape.d).fill(colour ?? shape.fill);
    doc.restore();
    return mark.height * scale;
}
