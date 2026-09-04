import { CustomerForm } from "@/components/customers/CustomerForm";

export const metadata = {
    title: "New Customer | MOTION Workshop Manager",
};

export default function NewCustomerPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <CustomerForm />
        </div>
    );
}
