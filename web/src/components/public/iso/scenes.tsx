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

/**
 * Pricing: three columns, each taller than the last, each with a card hovering
 * over it.
 *
 * The tiers as a physical thing. Height is the only variable — same footprint,
 * same spacing, rising left to right — because the difference between the
 * plans is how much is included rather than how different they are, and three
 * columns of different widths would say the opposite.
 *
 * The ribbon runs up the diagonal past all three, so the document's journey
 * crosses the prices rather than stopping at them.
 */
export function PricingScene() {
    return (
        <>
            <IsoBox x={0} y={0} w={340} d={340} h={20} z={0} top={GROUND}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 34px)" }} />
                <svg viewBox="0 0 340 340" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <path d="M20 320 C 60 300, 50 250, 75 225 S 150 170, 170 160 S 250 120, 265 105 S 320 30, 320 20" fill="none" stroke="rgba(45,212,191,0.22)" strokeWidth={16} strokeLinecap="round" />
                    <path d="M20 320 C 60 300, 50 250, 75 225 S 150 170, 170 160 S 250 120, 265 105 S 320 30, 320 20" fill="none" stroke={BRIGHT} strokeWidth={5} strokeLinecap="round" />
                </svg>
            </IsoBox>

            <IsoShade x={42} y={192} w={70} h={70} z={21} opacity={0.45} />
            <IsoShade x={137} y={132} w={70} h={70} z={21} opacity={0.45} />
            <IsoShade x={232} y={72} w={70} h={70} z={21} opacity={0.45} />

            {/* 30, 66, 112 — the steps are not even. Workshop to Full is a real
                jump; Full to a quoted council contract is a larger one. */}
            <IsoBox x={40} y={190} w={70} d={70} h={30} z={20} top={BRAND} settle={0} />
            <IsoBox x={135} y={130} w={70} d={70} h={66} z={20} top={BRIGHT} into={BRAND} settle={1} />
            <IsoBox x={230} y={70} w={70} d={70} h={112} z={20} top={PAPER} into="#64748b" settle={2} />

            <IsoCylinder x={150} y={250} r={16} h={12} z={20} body={BRAND} cap={BRIGHT} settle={3} />
            <IsoCylinder x={184} y={262} r={16} h={20} z={20} body={BRAND} cap={BRIGHT} settle={4} />

            <IsoBox x={45} y={195} w={60} d={42} h={3} z={76} top={PAPER} into="#64748b" settle={5} float={7}>
                <Sheet><Line w={70} /><Line w={46} /></Sheet>
            </IsoBox>
            <IsoBox x={140} y={135} w={60} d={42} h={3} z={112} top={PAPER} into="#64748b" settle={6} float={9}>
                <Sheet><Line w={70} /><Line w={46} /></Sheet>
            </IsoBox>
            <IsoBox x={235} y={75} w={60} d={42} h={3} z={158} top={BRAND} settle={7} float={11}>
                <Sheet>
                    <b style={{ display: "block", height: 6, width: "70%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                    <b style={{ display: "block", height: 6, width: "46%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                </Sheet>
            </IsoBox>
        </>
    );
}

/**
 * Getting started: boxes going into a crate, and one still in the air.
 *
 * What a migration actually is — your records picked up from wherever they are
 * and set down here. The one still floating is the point: it is in progress,
 * not finished, and somebody is doing it with you.
 */
export function MigrationScene() {
    return (
        <>
            <IsoBox x={0} y={0} w={260} d={260} h={12} z={0} top={TINT} into="#64748b">
                <svg viewBox="0 0 260 260" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <path d="M60 160 C 100 160, 100 110, 132 110 S 170 146, 206 146" fill="none" stroke="rgba(13,148,136,0.14)" strokeWidth={16} strokeLinecap="round" />
                    <path d="M60 160 C 100 160, 100 110, 132 110 S 170 146, 206 146" fill="none" stroke={BRAND} strokeWidth={5} strokeLinecap="round" />
                </svg>
            </IsoBox>

            <IsoShade x={22} y={122} w={60} h={60} z={13} opacity={0.18} />
            {/* The old system: a stack, lighter than everything else, on its way out. */}
            <IsoBox x={20} y={120} w={60} d={60} h={34} z={12} top={TINT} into="#64748b" settle={0} />
            <IsoBox x={28} y={128} w={44} d={44} h={26} z={46} top={TINT} into="#64748b" settle={1} />

            {/* The crate it lands in, and three records already set down. */}
            <IsoBox x={165} y={105} w={82} d={82} h={6} z={12} top={GROUND} settle={2} />
            <IsoBox x={172} y={112} w={32} d={32} h={24} z={18} top={BRAND} settle={3} />
            <IsoBox x={208} y={112} w={32} d={32} h={24} z={18} top={BRAND} settle={4} />
            <IsoBox x={172} y={148} w={32} d={32} h={24} z={18} top={BRAND} settle={5} />

            <IsoBox x={118} y={96} w={28} d={28} h={22} z={58} top={BRIGHT} into={BRAND} settle={6} float={10} />
        </>
    );
}

/**
 * Help: a stack of pages, with the answer on the top one.
 *
 * Six sheets at the same footprint, each a little higher and a little further
 * along, so the stack leans the way a real pile of paper does. The lowest is
 * brand-coloured and the rest are white — the manual has a cover.
 *
 * Only the top sheet carries any content, and what it carries is a heading,
 * then a short teal bar, then body lines. That bar is the answer-in-one-
 * sentence every article opens with, which is the whole shape of this manual
 * said without a word.
 */
export function ManualScene() {
    const SHEETS = [
        { z: 30, x: 90, y: 76, top: BRAND, amp: 3.0 },
        { z: 39, x: 92, y: 74, top: PAPER, amp: 4.6 },
        { z: 48, x: 94, y: 72, top: PAPER, amp: 6.2 },
        { z: 57, x: 96, y: 70, top: PAPER, amp: 7.8 },
        { z: 66, x: 98, y: 68, top: PAPER, amp: 9.4 },
    ];

    return (
        <>
            <IsoBox x={0} y={0} w={320} d={320} h={14} z={0} top={PAPER} into="#64748b">
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 32px)" }} />
                <svg viewBox="0 0 320 320" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <path d="M16 304 C 90 300, 70 214, 140 196 S 262 96, 304 16" fill="none" stroke="rgba(13,148,136,0.14)" strokeWidth={16} strokeLinecap="round" />
                    <path d="M16 304 C 90 300, 70 214, 140 196 S 262 96, 304 16" fill="none" stroke={BRAND} strokeWidth={5} strokeLinecap="round" />
                </svg>
            </IsoBox>

            <IsoShade x={96} y={72} w={152} h={182} z={15} opacity={0.16} />

            <IsoCylinder x={34} y={214} r={24} h={28} z={14} body={BRAND} cap={BRIGHT} settle={0} />
            <IsoBox x={246} y={238} w={40} d={40} h={40} z={14} top={BRIGHT} into={BRAND} settle={1} />

            {SHEETS.map((s, i) => (
                <IsoBox
                    key={s.z}
                    x={s.x}
                    y={s.y}
                    w={152}
                    d={182}
                    h={3}
                    z={s.z}
                    top={s.top}
                    into={s.top === PAPER ? "#64748b" : GROUND}
                    settle={2 + i}
                    float={s.amp}
                />
            ))}

            {/* The top sheet, and the only one anybody reads. */}
            <IsoBox x={100} y={66} w={152} d={182} h={3} z={75} top={PAPER} into="#64748b" settle={7} float={11}>
                <Sheet>
                    <Line w={74} tone="#0f172a" />
                    <Line w={46} tone="#0f172a" />
                    <b style={{ display: "block", height: 11, width: "60%", borderRadius: 4, background: BRAND, margin: "5px 0 2px" }} />
                    <Line w={84} /><Line w={70} /><Line w={78} /><Line w={52} />
                </Sheet>
            </IsoBox>

            <IsoBox x={26} y={34} w={84} d={54} h={4} z={132} top={BRAND} settle={8} float={13}>
                <Sheet>
                    <b style={{ display: "block", height: 6, width: "72%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                    <b style={{ display: "block", height: 6, width: "48%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                </Sheet>
            </IsoBox>
        </>
    );
}

/**
 * Support: a phone with a conversation on it, and a checklist beside it.
 *
 * The two things this page is about, set down next to each other. The thread
 * alternates — them, us, them, us — because support here is a conversation in
 * one exchange rather than a ticket queue. The list has three ticked and two
 * not, which is what "what to have ready" looks like while you are still
 * gathering it.
 */
export function SupportScene() {
    return (
        <>
            <IsoBox x={0} y={0} w={320} d={320} h={14} z={0} top={PAPER} into="#64748b">
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(45,212,191,0.14) 0 1px, transparent 1px 32px)" }} />
                <svg viewBox="0 0 320 320" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <path d="M16 120 C 70 120, 60 200, 120 230 S 250 250, 304 304" fill="none" stroke="rgba(13,148,136,0.14)" strokeWidth={16} strokeLinecap="round" />
                    <path d="M16 120 C 70 120, 60 200, 120 230 S 250 250, 304 304" fill="none" stroke={BRAND} strokeWidth={5} strokeLinecap="round" />
                </svg>
            </IsoBox>

            <IsoShade x={76} y={68} w={112} h={196} z={15} opacity={0.2} />

            {/* The phone. Dark, because it is the one object here that is a
                device rather than paper. */}
            <IsoBox x={74} y={66} w={112} d={196} h={12} z={14} top={GROUND} settle={0}>
                <div style={{ position: "absolute", inset: "9px 9px 16px", background: PAPER, borderRadius: 9, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <b style={{ display: "block", height: 24, width: "64%", borderRadius: 8, background: HAIR }} />
                    <b style={{ display: "block", height: 24, width: "56%", borderRadius: 8, background: BRAND, alignSelf: "flex-end" }} />
                    <b style={{ display: "block", height: 24, width: "40%", borderRadius: 8, background: HAIR }} />
                    <b style={{ display: "block", height: 24, width: "40%", borderRadius: 8, background: BRAND, alignSelf: "flex-end" }} />
                </div>
            </IsoBox>

            <IsoCylinder x={30} y={238} r={20} h={24} z={14} body={BRAND} cap={BRIGHT} settle={1} />

            <IsoBox x={200} y={170} w={94} d={116} h={3} z={54} top={PAPER} into="#64748b" settle={2} float={8}>
                <div style={{ position: "absolute", inset: 0, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                    {[true, true, true, false, false].map((done, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <b style={{ width: 11, height: 11, borderRadius: 3, flex: "none", border: `2px solid ${done ? BRAND : HAIR}`, background: done ? BRAND : "transparent" }} />
                            <i style={{ display: "block", height: 6, borderRadius: 3, background: HAIR, width: `${[70, 54, 64, 46, 58][i]}%` }} />
                        </div>
                    ))}
                </div>
            </IsoBox>

            <IsoBox x={196} y={36} w={98} d={58} h={5} z={106} top={BRAND} settle={3} float={10}>
                <Sheet>
                    <b style={{ display: "block", height: 6, width: "74%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                    <b style={{ display: "block", height: 6, width: "52%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                    <b style={{ display: "block", height: 6, width: "62%", borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
                </Sheet>
            </IsoBox>
        </>
    );
}
