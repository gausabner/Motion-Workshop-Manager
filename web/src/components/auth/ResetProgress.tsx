import { StepProgress } from "@/components/auth/StepProgress";

/**
 * Where somebody is in getting back into their account.
 *
 * Three steps, shown on every screen of the flow. It exists because a password
 * reset is the one journey a user takes while already annoyed, and it crosses
 * an email client — they leave the browser at step two and come back minutes
 * later, possibly on a different device, with no memory of what they had
 * started.
 *
 * The bar and its accessibility live in `StepProgress`, shared with
 * registration. What stays here is the only thing specific to a reset: the
 * three steps and their names.
 */

export const RESET_STEPS = [
    { id: "ask", label: "Your email" },
    { id: "sent", label: "Check your inbox" },
    { id: "set", label: "New password" },
] as const;

export type ResetStep = (typeof RESET_STEPS)[number]["id"];

export function ResetProgress({ current }: { current: ResetStep }) {
    return <StepProgress steps={RESET_STEPS} current={current} />;
}
