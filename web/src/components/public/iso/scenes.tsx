/**
 * The five scenes, one per stage of the document.
 *
 * Each is a small still life of the thing that stage actually produces — a
 * priced sheet with a tag on it, a week with jobs blocked out, a clipboard
 * with ticks, a receipt with a message beside it, notes and coin. They are
 * meant to be recognised at a glance by somebody who has run a workshop for
 * fifteen years, not admired as illustration.
 *
 * Coordinates are in the platform's own 260 × 260 space. Everything is
 * numbers in one place rather than inline styles spread through markup, so a
 * scene can be nudged without reading past three faces and five custom
 * properties per object.
 */

import { IsoBox, IsoCylinder, IsoShade } from "@/components/public/iso/primitives";

const PAPER = "#ffffff";
const TINT = "#f1f5f9";
const HAIR = "#e2e8f0";
const BRAND = "#0d9488";
const BRIGHT = "#2dd4bf";
const GROUND = "#042f2e";
const AMBER = "#f59e0b";

/** A ruled line on a document face. */
function Line({ w, tone = HAIR }: { w: number; tone?: string }) {
    return <i style={{ display: "block", height: 6, width: `${w}%`, borderRadius: 3, background: tone }} />;
}

function Sheet({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            {children}
        </div>
    );
}

/** The platform every scene stands on. */
function Tile({ top = PAPER }: { top?: string }) {
    return <IsoBox x={0} y={0} w={260} d={260} h={12} z={0} top={top} into="#64748b" />;
}

// ── 01 Quote ────────────────────────────────────────────────────────────────
export function QuoteScene() {
    return (
        <>
            <Tile />
            <IsoShade x={46} y={36} w={140} h={180} z={13} opacity={0.22} />
            <IsoBox x={44} y={34} w={140} d={180} h={4} z={30} top={PAPER} into="#64748b" settle={0} float={8}>
                <Sheet>
                    <b style={{ display: "block", height: 14, width: "55%", borderRadius: 4, background: BRAND, marginBottom: 4 }} />
                    <Line w={80} /><Line w={60} /><Line w={72} /><Line w={66} /><Line w={40} />
                    <b style={{ display: "block", marginTop: "auto", height: 12, width: "50%", alignSelf: "flex-end", borderRadius: 4, background: BRAND }} />
                </Sheet>
            </IsoBox>
            <IsoShade x={130} y={132} w={104} h={56} z={13} opacity={0.28} />
            {/* The price, on a tag — the one thing the customer actually asked for. */}
            <IsoBox x={128} y={130} w={104} d={56} h={6} z={70} top={BRAND} settle={1} float={11}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", color: PAPER, fontSize: 15, fontWeight: 500 }}>
                    <b style={{ width: 10, height: 10, borderRadius: "50%", background: GROUND, flex: "none" }} />
                    <span className="tabular">N$</span>
                    <i style={{ display: "block", height: 6, width: "46%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                </div>
            </IsoBox>
        </>
    );
}

// ── 02 The diary ────────────────────────────────────────────────────────────
export function DiaryScene() {
    const jobs = [
        { x: 61.6, y: 77, h: 14, t: BRAND }, { x: 90.2, y: 77, h: 14, t: BRAND },
        { x: 147.4, y: 108, h: 24, t: BRIGHT }, { x: 33.0, y: 139, h: 10, t: BRAND },
        { x: 118.8, y: 139, h: 18, t: BRIGHT }, { x: 176.0, y: 170, h: 12, t: BRAND },
        { x: 204.6, y: 170, h: 12, t: BRAND }, { x: 90.2, y: 201, h: 20, t: BRIGHT },
    ];
    return (
        <>
            <Tile top={TINT} />
            <IsoBox x={20} y={24} w={220} d={212} h={8} z={12} top={PAPER} into="#64748b" settle={0}>
                <div style={{ position: "absolute", inset: 0, padding: 10 }}>
                    <b style={{ display: "block", height: 14, width: "40%", borderRadius: 4, background: BRAND, margin: "2px 0 22px" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gridAutoRows: "31px", borderTop: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>
                        {Array.from({ length: 35 }, (_, i) => <i key={i} style={{ borderRight: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }} />)}
                    </div>
                </div>
            </IsoBox>
            {/* Blocks of work standing in the week. Taller means longer. */}
            {jobs.map((j, i) => (
                <IsoBox key={i} x={j.x} y={j.y} w={22.6} d={25} h={j.h} z={20} top={j.t} settle={i + 1} />
            ))}
        </>
    );
}

// ── 03 Job card ─────────────────────────────────────────────────────────────
export function JobCardScene() {
    return (
        <>
            <Tile />
            <IsoShade x={46} y={24} w={168} h={220} z={13} opacity={0.22} />
            <IsoBox x={44} y={22} w={168} d={220} h={8} z={12} top={GROUND} settle={0} />
            <IsoBox x={60} y={48} w={136} d={182} h={2} z={20} top={PAPER} into="#64748b" settle={1}>
                <div style={{ position: "absolute", inset: 0, padding: "26px 14px 0 40px", display: "flex", flexDirection: "column", gap: 20 }}>
                    {[62, 74, 50, 68].map((w, i) => (
                        <div key={i} style={{ height: 18, display: "flex", alignItems: "center" }}><Line w={w} /></div>
                    ))}
                </div>
            </IsoBox>
            <IsoBox x={98} y={30} w={60} d={18} h={12} z={20} top={BRIGHT} settle={2} />
            {/* Three ticked, one still open — the state of a bay at four o'clock. */}
            {[74, 112, 150].map((y, i) => (
                <IsoBox key={y} x={74} y={y} w={18} d={18} h={6} z={22} top={BRAND} settle={3 + i} />
            ))}
            <IsoBox x={74} y={188} w={18} d={18} h={6} z={22} top={TINT} into="#64748b" settle={6} />
        </>
    );
}

// ── 04 Invoice ──────────────────────────────────────────────────────────────
export function InvoiceScene() {
    return (
        <>
            <Tile top={TINT} />
            <IsoShade x={36} y={24} w={130} h={214} z={13} opacity={0.22} />
            <IsoBox x={34} y={22} w={130} d={214} h={4} z={26} top={PAPER} into="#64748b" settle={0} className="iso-receipt">
                <Sheet>
                    <b style={{ display: "block", height: 14, width: "55%", borderRadius: 4, background: BRAND, marginBottom: 4 }} />
                    <Line w={70} /><Line w={54} /><Line w={64} /><Line w={58} /><Line w={44} />
                    <b style={{ display: "block", marginTop: "auto", height: 12, width: "50%", alignSelf: "flex-end", borderRadius: 4, background: "#0f172a" }} />
                </Sheet>
            </IsoBox>
            <IsoShade x={148} y={150} w={96} h={58} z={13} opacity={0.28} />
            {/* The same document, leaving by WhatsApp. */}
            <IsoBox x={146} y={148} w={96} d={58} h={5} z={74} top={BRAND} settle={1} float={10}>
                <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <Line w={72} tone="rgba(255,255,255,0.7)" />
                    <Line w={50} tone="rgba(255,255,255,0.7)" />
                </div>
            </IsoBox>
            <IsoBox x={150} y={204} w={16} d={16} h={5} z={66} top={BRAND} settle={2} float={7} />
        </>
    );
}

// ── 05 Payment ──────────────────────────────────────────────────────────────
export function PaymentScene() {
    return (
        <>
            <Tile />
            <IsoShade x={22} y={142} w={150} h={96} z={13} opacity={0.3} />
            <IsoBox x={20} y={140} w={150} d={96} h={4} z={16} top={GROUND} settle={0}>
                <div style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <b style={{ display: "block", width: 30, height: 22, borderRadius: 5, background: BRIGHT }} />
                    <Line w={58} tone="rgba(255,255,255,0.7)" />
                </div>
            </IsoBox>
            {/* A stack of notes, alternating so the pile reads as separate leaves. */}
            {[12, 17, 22, 27, 32, 37].map((z, i) => (
                <IsoBox key={z} x={120} y={34} w={118} d={66} h={4} z={z} top={i % 2 ? BRAND : BRIGHT} settle={1 + i} />
            ))}
            <IsoCylinder x={40} y={40} r={24} h={22} z={12} body={BRAND} cap={BRIGHT} settle={7} />
            <IsoCylinder x={64} y={86} r={24} h={36} z={12} body={BRAND} cap={BRIGHT} settle={8} />
        </>
    );
}

// ── The hero platform ───────────────────────────────────────────────────────
export function HeroScene() {
    return (
        <>
            <IsoBox x={0} y={0} w={380} d={380} h={22} z={0} top={GROUND}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(45,212,191,0.22) 0 1px, transparent 1px 38px), repeating-linear-gradient(90deg, rgba(45,212,191,0.22) 0 1px, transparent 1px 38px)" }} />
                {/* The document's route across the floor, corner to corner. The
                    whole argument of the page, drawn once. */}
                <svg viewBox="0 0 380 380" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <path d="M18 362 C 120 362, 110 250, 190 210 S 300 70, 362 18" fill="none" stroke="rgba(45,212,191,0.22)" strokeWidth={16} strokeLinecap="round" />
                    <path d="M18 362 C 120 362, 110 250, 190 210 S 300 70, 362 18" fill="none" stroke={BRIGHT} strokeWidth={5} strokeLinecap="round" />
                    <circle cx={18} cy={362} r={7} fill={GROUND} stroke={BRIGHT} strokeWidth={4} />
                    <circle cx={362} cy={18} r={7} fill={GROUND} stroke={BRIGHT} strokeWidth={4} />
                </svg>
            </IsoBox>

            <IsoShade x={128} y={122} w={150} h={190} z={23} opacity={0.38} />
            <IsoShade x={46} y={50} w={110} h={72} z={23} opacity={0.3} />
            <IsoShade x={256} y={258} w={100} h={70} z={23} opacity={0.3} />

            <IsoCylinder x={36} y={196} r={34} h={40} z={22} body={BRAND} cap={BRIGHT} settle={0} />
            <IsoBox x={298} y={56} w={46} d={46} h={46} z={22} top={BRIGHT} settle={1} />
            <IsoBox x={46} y={296} w={30} d={30} h={30} z={22} top="#0f172a" into="#000" settle={2} />

            <IsoBox x={120} y={112} w={150} d={190} h={6} z={86} top={PAPER} into="#64748b" settle={3} float={10}>
                <Sheet>
                    <b style={{ display: "block", height: 14, width: "55%", borderRadius: 4, background: BRAND, marginBottom: 4 }} />
                    <Line w={82} /><Line w={64} /><Line w={74} /><Line w={46} />
                    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                        <b style={{ display: "block", height: 16, width: 44, borderRadius: 8, background: BRAND }} />
                        <b style={{ display: "block", height: 16, width: 44, borderRadius: 8, border: `2px solid ${BRIGHT}` }} />
                    </div>
                </Sheet>
            </IsoBox>

            <IsoBox x={36} y={38} w={112} d={72} h={6} z={140} top={BRAND} settle={4} float={13}>
                <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <Line w={70} tone="rgba(255,255,255,0.7)" />
                    <Line w={48} tone="rgba(255,255,255,0.7)" />
                    <b style={{ position: "absolute", right: 12, bottom: 12, width: 14, height: 14, borderRadius: "50%", background: PAPER }} />
                </div>
            </IsoBox>

            <IsoBox x={250} y={250} w={100} d={70} h={5} z={64} top={PAPER} into="#64748b" settle={5} float={9}>
                <div style={{ position: "absolute", inset: 0, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Line w={76} /><Line w={52} />
                    {/* The one amber thing: a licence disc about to expire. */}
                    <b style={{ position: "absolute", right: 10, bottom: 10, width: 10, height: 10, borderRadius: "50%", background: AMBER }} />
                </div>
            </IsoBox>

            <IsoBox x={286} y={168} w={26} d={26} h={26} z={150} top={AMBER} into="#0f172a" settle={6} float={14} />
        </>
    );
}
