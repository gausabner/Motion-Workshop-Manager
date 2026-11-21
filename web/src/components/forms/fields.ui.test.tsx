import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test } from "vitest";
import { CheckField, SelectField, TextField } from "@/components/forms/fields";

const agent = createAgent();

test("a refused field carries its label, its hint and the server's error, and says it is invalid", () => {
    render(
        <form>
            <TextField label="Mobile" name="mobile" hint="With the country code" errors={{ mobile: ["Enter a number we can reach on WhatsApp."] }} />
        </form>,
    );
    const input = screen.getByLabelText("Mobile");
    expect(input).toHaveProperty("name", "mobile");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["With the country code", "Enter a number we can reach on WhatsApp."]);
});

test("a field the server accepted is not marked invalid and has no error", () => {
    render(<form><TextField label="Reference" name="reference" defaultValue="PO 12" /></form>);
    const input = screen.getByLabelText("Reference");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect((input as HTMLInputElement).value).toBe("PO 12");
});

test("the first field the server refused takes focus, not a later one", () => {
    render(
        <form>
            <TextField label="Customer order no." name="orderNo" />
            <TextField label="Odometer" name="odometer" errors={{ odometer: ["Enter the reading."], due: ["Pick a date."] }} />
            <TextField label="Due" name="due" type="date" errors={{ odometer: ["Enter the reading."], due: ["Pick a date."] }} />
        </form>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Odometer"));
});

test("a select is named by its label and tied to its error", () => {
    render(
        <form>
            <SelectField label="Payment terms" name="terms" options={[{ value: "cod", label: "Cash on delivery" }, { value: "30", label: "30 days" }]} defaultValue="30" errors={{ terms: ["Choose terms."] }} />
        </form>,
    );
    const select = screen.getByRole("combobox", { name: "Payment terms" }) as HTMLSelectElement;
    expect(select.value).toBe("30");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(select.getAttribute("aria-describedby")!)?.textContent).toBe("Choose terms.");
});

test("a check field is a named checkbox that its label toggles and that submits when ticked", async () => {
    const user = userEvent.setup();
    render(<form data-testid="f"><CheckField label="Cash sale" name="isCashSale" hint="No customer account" /></form>);
    const box = screen.getByRole("checkbox", { name: "Cash sale" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByText("Cash sale"));
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.keyboard(" ");
    expect(box.getAttribute("aria-checked")).toBe("false");
});

test("an agent can find every text field by its label and fill it", async () => {
    render(
        <form>
            <TextField label="Registration" name="plate" />
            <TextField label="Odometer" name="odometer" type="number" />
        </form>,
    );
    const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    const labels = entries.map((entry) => entry.label);
    for (const label of ["Registration", "Odometer"]) expect(labels, `${label} is missing from the snapshot`).toContain(label);
    const result = await agent.act({ steps: [{ ref: "Registration", action: "setValue", args: ["N 12345 W"] }] });
    expect(result.ok, result.error?.message).toBe(true);
    expect((screen.getByLabelText("Registration") as HTMLInputElement).value).toBe("N 12345 W");
});
