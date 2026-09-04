import { ServiceAdvisorForm } from "@/components/admin/ServiceAdvisorForm";

export const metadata = {
    title: "New Service Advisor | Admin | MOTION Workshop Manager",
};

export default function NewServiceAdvisorPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <ServiceAdvisorForm />
        </div>
    );
}
