import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";
import { expect, test } from "vitest";
import { ConfirmProvider, useConfirm } from "@/components/ui/confirm";

let approve = false;
const agent = createAgent({ allow: (step) => !step.confirm || approve });

function CancelOrder() {
    const confirm = useConfirm();
    const [answer, setAnswer] = useState("none");
    return (
        <>
            <button type="button" onClick={async () => setAnswer(String(await confirm({ title: "Cancel this order?", description: "The supplier is not told.", confirm: "Cancel the order", cancel: "Keep the order" })))}>
                Cancel order
            </button>
            <p data-testid="answer">{answer}</p>
        </>
    );
}

const answer = () => screen.getByTestId("answer").textContent;

test("the question is an alert dialog named by its title, and focus starts on the safe answer", async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><CancelOrder /></ConfirmProvider>);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel this order?" });
    expect(dialog.getAttribute("aria-describedby") && document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("The supplier is not told.");
    await act(() => settle());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep the order" }));
    expect(screen.getByRole("button", { name: "Cancel the order" }).getAttribute("data-agent-confirm")).toBe("Cancel this order?");
});

test("keeping answers no, agreeing answers yes, and focus goes back to the button that asked", async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><CancelOrder /></ConfirmProvider>);
    const asker = screen.getByRole("button", { name: "Cancel order" });

    await user.click(asker);
    await user.click(await screen.findByRole("button", { name: "Keep the order" }));
    await act(() => settle());
    expect(answer()).toBe("false");
    expect(document.activeElement).toBe(asker);

    await user.click(asker);
    await user.click(await screen.findByRole("button", { name: "Cancel the order" }));
    await act(() => settle());
    expect(answer()).toBe("true");
});

test("Escape answers no", async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><CancelOrder /></ConfirmProvider>);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await act(() => settle());
    expect(answer()).toBe("false");
});

test("an agent cannot agree without the person, and can once they allow it", async () => {
    render(<ConfirmProvider><CancelOrder /></ConfirmProvider>);
    const user = userEvent.setup();
    const agreeing = { steps: [{ ref: "Cancel this order?", action: "press", args: ["Cancel the order"] }] };

    approve = false;
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await screen.findByRole("alertdialog");
    expect((await agent.act(agreeing)).ok).toBe(false);
    await act(() => settle());
    expect(answer()).not.toBe("true");

    approve = true;
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await screen.findByRole("alertdialog");
    const result = await agent.act(agreeing);
    expect(result.ok, result.error?.message).toBe(true);
    await act(() => settle());
    expect(answer()).toBe("true");
});

test("asking without a provider is a mistake the developer hears about", () => {
    const quiet = console.error;
    console.error = () => {};
    try {
        expect(() => render(<CancelOrder />)).toThrow(/ConfirmProvider/);
    } finally {
        console.error = quiet;
    }
});
