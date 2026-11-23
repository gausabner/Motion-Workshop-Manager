"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** A link that knows when it is where you are: `aria-current="page"` and the current look, on this path or under it. */
export function NavLink({ href, className, currentClassName, children }: { href: string; className?: string; currentClassName?: string; children: React.ReactNode }) {
    const pathname = usePathname();
    const current = pathname === href || pathname.startsWith(`${href}/`);
    return (
        <Link href={href} aria-current={current ? "page" : undefined} className={cn(className, current && currentClassName)}>
            {children}
        </Link>
    );
}
