import { BookingSettingsForm } from "@/components/settings/BookingSettingsForm";

export default function BookingSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Booking & Schedule</h3>
                <p className="text-sm text-slate-500">
                    Configure how the calendar renders default mechanic capacities and handles incoming appointment slots.
                </p>
            </div>
            <div className="border-t border-slate-200 my-4" />
            <BookingSettingsForm />
        </div>
    );
}
