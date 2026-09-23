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
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // Android crops a maskable icon to whatever shape the launcher uses.
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
