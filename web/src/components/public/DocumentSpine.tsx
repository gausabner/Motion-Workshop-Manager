import { IsoScene } from "@/components/public/iso/primitives";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoMotion } from "@/components/public/iso/IsoMotion";
import { DiaryScene, InvoiceScene, JobCardScene, PaymentScene, QuoteScene } from "@/components/public/iso/scenes";
import { Reveal } from "@/components/public/Reveal";

/**
 * The product's whole argument, as a page you scroll.
 *
 * One document goes from a phone call to money in the bank, and nothing is
 * retyped on the way. The ribbon weaving down the middle *is* that document —
 * it never breaks between stages, which is the point being made, so the five
 * sections share one continuous path rather than each drawing its own.
 *
 * The copy is the product's own, unchanged. It was written for the landing
 * page and it is better than anything an illustration caption would be.
 */

const STAGES = [
    { n: "01", label: "Quote", line: "A price, before anybody has committed to anything.", Scene: QuoteScene, tint: true },
    { n: "02", label: "The diary", line: "A day in the diary, on the same document.", Scene: DiaryScene, tint: false },
    { n: "03", label: "Job card", line: "Mechanics clock on. Parts come off stock against it.", Scene: JobCardScene, tint: true },
    { n: "04", label: "Invoice", line: "The same document, priced and sent by WhatsApp.", Scene: InvoiceScene, tint: false },
    { n: "05", label: "Payment", line: "Paid, part-paid or owing — worked out, never typed.", Scene: PaymentScene, tint: true },
] as const;

/**
 * The route, in the viewBox's own 100 × 1000 space. It leans left, right, left
 * so each stage's scene sits on the outside of a bend rather than being cut
 * through by the line.
 */
const ROUTE =
    "M50 0 C50 55 12 45 12 100 C12 155 50 145 50 200 C50 255 88 245 88 300 " +
    "C88 355 50 345 50 400 C50 455 12 445 12 500 C12 555 50 545 50 600 " +
    "C50 655 88 645 88 700 C88 755 50 745 50 800 C50 855 12 845 12 900 C12 955 50 945 50 1000";

function Ribbon({ className, variant }: { className?: string; variant: "track" | "fill" }) {
    const stroke = variant === "track" ? "#e2e8f0" : "#0d9488";
    return (
        <svg
            aria-hidden
            viewBox="0 0 100 1000"
            preserveAspectRatio="none"
            className={`pointer-events-none absolute inset-y-0 left-[var(--spine-x)] z-[1] h-full w-[var(--spine-w)] -translate-x-1/2 overflow-visible ${className ?? ""}`}
        >
            {variant === "fill" && (
                // The soft bed under the line. Wider and barely there, it gives
                // the ribbon weight without thickening the line itself.
                <path d={ROUTE} fill="none" stroke="rgba(13,148,136,0.14)" strokeWidth={20} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
            <path d={ROUTE} fill="none" stroke={stroke} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

export function DocumentSpine() {
    return (
        <section
            className="spine relative [--spine-x:50%] [--spine-w:12rem] max-md:[--spine-x:1.25rem] max-md:[--spine-w:1.5rem]"
            aria-label="How one document carries the job"
        >
            {/* Two copies of the same path: the grey one is the road ahead, the
                teal one is how far the document has come. The fill is clipped
                by a scroll-driven animation, so the main thread never sees it. */}
            <Ribbon variant="track" />
            <Ribbon variant="fill" className="spine-fill" />

            {STAGES.map(({ n, label, line, Scene, tint }, i) => {
                const figureFirst = i % 2 === 0;
                return (
                    <div key={n} data-stage className={`relative ${tint ? "bg-slate-100" : "bg-white"}`}>
                        <span
                            aria-hidden
                            className="absolute left-[var(--spine-x)] top-0 z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-teal-600 bg-white text-[12px] font-medium text-slate-900 tabular max-md:h-6 max-md:w-6 max-md:text-[10px]"
                        >
                            {i + 1}
                        </span>

                        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-4 px-5 py-24 md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] max-md:py-20 max-md:pl-12">
                            <div className={figureFirst ? "md:order-1" : "md:order-3"}>
                                {/* Each scene listens to its own band via
                                    `data-stage`. The only `section` here wraps
                                    all five, so a `section` scope would give
                                    every scene the same enormous region.
                                    Quieter than the hero too: five of these
                                    pass in one scroll, and a tilt that reads as
                                    alive once reads as restless by the fifth. */}
                                <IsoMotion scope="[data-stage]" tilt={6} drift={10}>
                                    <IsoStage height={420} className="max-md:h-80">
                                        <IsoScene size={260} scale={1.18} top="56%" className="max-md:[zoom:0.78]">
                                            <Scene />
                                        </IsoScene>
                                    </IsoStage>
                                </IsoMotion>
                            </div>

                            <div aria-hidden className="hidden md:order-2 md:block" />

                            <Reveal
                                className={`flex flex-col gap-5 ${figureFirst ? "md:order-3 md:items-start" : "md:order-1 md:items-end md:text-right"}`}
                            >
                                <span className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-900">
                                    <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                                    <span className="tabular">{n}</span> {label}
                                </span>
                                <h2 className="max-w-[16ch] text-balance text-[28px] font-semibold leading-[1.12] tracking-[-0.025em] text-slate-900 sm:text-[40px]">
                                    {line}
                                </h2>
                            </Reveal>
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
