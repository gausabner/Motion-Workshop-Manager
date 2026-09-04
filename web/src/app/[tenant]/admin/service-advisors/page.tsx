import { ServiceAdvisorList } from "@/components/admin/ServiceAdvisorList";

export const metadata = {
    title: "Service Advisors | Admin | MOTION Workshop Manager",
};

export default function ServiceAdvisorsPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <ServiceAdvisorList />
        </div>
    );
}
