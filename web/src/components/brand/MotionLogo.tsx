export function MotionLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 110 28" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="MOTION">
            <text x="0" y="22" fill="currentColor" className="font-bold text-2xl tracking-tight" style={{ fontFamily: "inherit" }}>
                motion
            </text>
            <path d="M 82 8 L 94 8 L 94 20 M 94 8 L 82 20" stroke="#0d9488" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    );
}
