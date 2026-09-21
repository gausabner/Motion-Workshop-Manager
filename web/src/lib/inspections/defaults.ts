import type { TenantDb } from "@/lib/tenant-db";

/** Created on first use by the tenant-scoped client, so it can only ever land in one workshop. */
type Tx = TenantDb;

/**
 * The inspection every workshop starts with. Four reading slots are used
 * where a mechanic actually measures four things — one per wheel.
 */
export const DEFAULT_INSPECTION: { group: string; items: { description: string; inputs?: string[] }[] }[] = [
    { group: "Brakes", items: [
        { description: "Front brake pads", inputs: ["Left mm", "Right mm"] },
        { description: "Rear brake pads / shoes", inputs: ["Left mm", "Right mm"] },
        { description: "Discs and drums" },
        { description: "Brake fluid", inputs: ["Moisture %"] },
    ] },
    { group: "Tyres", items: [
        { description: "Tread depth", inputs: ["FL mm", "FR mm", "RL mm", "RR mm"] },
        { description: "Tyre pressures", inputs: ["FL", "FR", "RL", "RR"] },
        { description: "Spare wheel and jack" },
    ] },
    { group: "Steering and suspension", items: [
        { description: "Shock absorbers" },
        { description: "Ball joints and tie-rod ends" },
        { description: "CV joints and boots" },
    ] },
    { group: "Under the bonnet", items: [
        { description: "Engine oil level and condition" },
        { description: "Coolant level and hoses" },
        { description: "Drive belts" },
        { description: "Battery", inputs: ["Volts", "CCA"] },
        { description: "Air filter" },
    ] },
    { group: "Lights and visibility", items: [
        { description: "Headlights and indicators" },
        { description: "Brake and tail lights" },
        { description: "Wiper blades and washers" },
        { description: "Windscreen" },
    ] },
    { group: "Underneath", items: [
        { description: "Exhaust system" },
        { description: "Oil and fluid leaks" },
    ] },
];

/** Idempotent: a workshop that already has templates is left alone. */
export async function ensureDefaultInspectionTemplate(tx: Tx, tenantId: string): Promise<void> {
    const existing = await tx.inspectionTemplate.count({ where: { tenantId } });
    if (existing > 0) return;
    const template = await tx.inspectionTemplate.create({ data: { tenantId, name: "Vehicle inspection", sortOrder: 1 }, select: { id: true } });
    let ordering = 0;
    for (const group of DEFAULT_INSPECTION) {
        for (const item of group.items) {
            await tx.inspectionTemplateItem.create({
                data: { tenantId, templateId: template.id, group: group.group, ordering: ordering++, description: item.description, inputLabels: item.inputs ?? [] },
            });
        }
    }
}
