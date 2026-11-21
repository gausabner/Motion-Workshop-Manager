"use client";

import { useRef } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { logoutAction } from "@/lib/auth/actions";

/** Beside the user's name, one press from the work, so it asks before it ends the session. */
export function SignOutButton() {
    const form = useRef<HTMLFormElement>(null);
    const confirm = useConfirm();
    return (
        <form ref={form} action={logoutAction}>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative hit-area rounded-full"
                aria-label="Sign out"
                onClick={async () => {
                    const yes = await confirm({
                        title: "Sign out of MOTION?",
                        description: "Changes on this screen that have not been saved will be lost.",
                        confirm: "Sign out",
                        cancel: "Stay signed in",
                    });
                    if (yes) form.current?.requestSubmit();
                }}
            >
                <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
        </form>
    );
}
