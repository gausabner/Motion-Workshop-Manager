import type { MetadataRoute } from "next";

/**
 * What makes the floor app installable.
 *
 * `start_url` is "/" rather than a workshop's own path, because one manifest
 * serves every tenant and the app finds its way from the session. A mechanic
 * adds it once and it opens where they left off.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "MOTION Workshop Manager",
        short_name: "MOTION",
        description: "The workshop floor: your jobs, and the clock.",
        start_url: "/",
        display: "standalone",
        background_color: "#f1f5f9",
        theme_color: "#0f172a",
        orientation: "portrait",
        icons: [
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // A separate file, not the same one declared twice. Android crops a
            // maskable icon to whatever shape the launcher uses, and the mark's
            // frame runs to the edge of its own artwork — declared maskable
            // unchanged, the launcher would cut the frame off and take the
            // brand with it. The maskable tile draws the mark at 64% so the
            // crop lands on ground.
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
