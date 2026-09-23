import { TemplateEditor } from "@/components/settings/TemplateEditor";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { EDITABLE_TEMPLATES } from "@/lib/templates/catalogue";
import { workshopValues } from "@/lib/templates/values";
import { money } from "@/lib/format";
import { reminderSettings } from "@/lib/settings/schema";
import { ReminderSettingsForm } from "@/components/settings/ReminderSettingsForm";

export const metadata = { title: "Messages and templates | MOTION Workshop Manager" };

export default async function MessagingSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;

    const rows = await db.template.findMany({ where: { kind: { in: EDITABLE_TEMPLATES.map((t) => t.kind) } }, orderBy: { sortOrder: "asc" }, select: { kind: true, body: true } });
    const saved = new Map<string, string>();
    for (const row of rows) if (!saved.has(row.kind)) saved.set(row.kind, row.body);

    // Real workshop details, made-up customer: the preview should look like the workshop's own message.
    const sample = {
        ...workshopValues(tenant),
        customer_name: "Courtney Farrell",
        customer_first_name: "Courtney",
        customer_mobile: "+264 81 744 4912",
        vehicle: "2021 Toyota Hilux 2.8 GD-6",
        plate: "N 12345 W",
        odometer: "88,400",
        next_service_km: "98,400",
        next_service_date: "18/03/2027",
        document_title: "Tax invoice",
        document_number: "INV-1004",
        document_date: "18/09/2026",
        due_date: "18/09/2026",
        scheduled_at: "22/09/2026",
        total: money(3480, tenant.currency),
        amount_due: money(3480, tenant.currency),
        account_balance: money(2980, tenant.currency),
        link: "https://motion.example/share/Xk2…",
    };

    const groups = ["Sent with documents", "Reminders", "Printed on documents"] as const;

    return (
        <div className="space-y-6 max-w-6xl pb-12">
            <div>
                <h3 className="text-lg font-medium">Messages and templates</h3>
                <p className="text-sm text-slate-500">
                    The wording that goes out with a document on WhatsApp or email, and the terms printed on the documents themselves.
                    Anything you have not changed uses the standard wording, and picks up improvements to it.
                </p>
            </div>
            {groups.map((group) => (
                <section key={group} id={group === "Reminders" ? "reminders" : undefined} className="space-y-3 scroll-mt-4">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group}</h4>
                    {group === "Reminders" && <ReminderSettingsForm tenant={slug} settings={reminderSettings(tenant.settings)} />}
                    {EDITABLE_TEMPLATES.filter((t) => t.group === group).map((t) => (
                        <TemplateEditor
                            key={t.kind}
                            tenant={slug}
                            kind={t.kind}
                            label={t.label}
                            description={t.description}
                            body={saved.get(t.kind) ?? t.defaultBody}
                            defaultBody={t.defaultBody}
                            custom={saved.has(t.kind) && saved.get(t.kind) !== t.defaultBody}
                            sample={sample}
                            showLinkHint={group === "Sent with documents"}
                        />
                    ))}
                </section>
            ))}
        </div>
    );
}
