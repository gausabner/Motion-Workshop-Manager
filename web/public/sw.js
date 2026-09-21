/*
 * The service worker for the floor app.
 *
 * It caches two things and refuses to be clever about anything else:
 *
 *   1. Static build assets, which never change under a given URL.
 *   2. The last floor page that loaded successfully, so a mechanic who walks
 *      into the pit and loses signal still sees their jobs and their clock.
 *
 * It deliberately does NOT cache the rest of the dashboard. An invoice or a
 * customer balance served from yesterday's cache is worse than an error
 * message — money that looks current and is not is how people get misled.
 *
 * Nothing is queued here either. The taps a mechanic makes offline are kept by
 * the page and sent by the page when the signal returns, because Background
 * Sync does not exist on iOS and half a workshop is on iPhones.
 */

const VERSION = "motion-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL)
            .then((cache) => cache.addAll(["/icon-192.png", "/icon.svg"]).catch(() => undefined))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

const isFloorPage = (url) => /^\/[^/]+\/pwa(\/|$)/.test(url.pathname);
const isBuildAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon");

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isBuildAsset(url)) {
        event.respondWith(
            caches.match(request).then(
                (hit) =>
                    hit ??
                    fetch(request).then((response) => {
                        // Only a complete, successful response is worth keeping.
                        if (response.ok) {
                            const copy = response.clone();
                            caches.open(SHELL).then((cache) => cache.put(request, copy));
                        }
                        return response;
                    }),
            ),
        );
        return;
    }

    if (isFloorPage(url) && request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(PAGES).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request, { ignoreSearch: true })) ?? offlineNotice()),
        );
    }
});

/** Shown only when a mechanic opens the app offline having never loaded it on this phone. */
function offlineNotice() {
    return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No signal</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}
p{max-width:22rem}b{color:#2dd4bf}</style></head>
<body><p><b>No signal.</b><br>Open the app once where there is signal and it will work down here afterwards.</p></body></html>`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
}
