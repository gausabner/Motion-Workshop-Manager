"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm";

/**
 * While there are unsaved changes, leaving asks first: a link anywhere in the
 * app opens the confirm, and closing or reloading the tab gets the browser's
 * own warning. A counter that is interrupted mid-edit should not lose the
 * line it just typed to a tap on the sidebar.
 */
export function useLeaveGuard(active: boolean): void {
    const confirm = useConfirm();
    const router = useRouter();

    useEffect(() => {
        if (!active) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        // Capture, before Next's Link sees the click, so the navigation can be held.
        const onClick = async (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
            const to = new URL(link.href, window.location.href);
            if (to.origin !== window.location.origin) return;
            if (to.pathname === window.location.pathname && to.search === window.location.search) return;
            event.preventDefault();
            event.stopPropagation();
            const leave = await confirm({
                title: "Leave without saving?",
                description: "Changes to this document that have not been saved will be lost.",
                confirm: "Leave without saving",
                cancel: "Stay on this document",
            });
            if (leave) router.push(`${to.pathname}${to.search}${to.hash}`);
        };
        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("click", onClick, true);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", onClick, true);
        };
    }, [active, confirm, router]);
}
