import { CustomerList } from "@/components/customers/CustomerList";

export const metadata = {
    title: "Customers | MOTION Workshop Manager",
};

export default function CustomersPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <CustomerList />
        </div>
    );
}
