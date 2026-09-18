import { ServiceAdvisorEditForm } from "@/components/admin/ServiceAdvisorEditForm";

export const metadata = {
    title: "Edit Service Advisor | Admin | MOTION Workshop Manager",
};

export default async function EditServiceAdvisorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <ServiceAdvisorEditForm id={id} />
        </div>
    );
}
