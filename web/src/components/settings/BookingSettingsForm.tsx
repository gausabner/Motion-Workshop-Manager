"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckField, Section, SelectField, TextField } from "@/components/forms/fields";
import { initialActionState } from "@/lib/forms";
import { saveDiarySettings } from "@/lib/diary/actions";

export type DiaryForm = {
    opensAt: string;
    closesAt: string;
    slotMinutes: number;
    workingDays: number[];
    fullAtPercent: number;
    lanesPerPage: number;
    defaultBookingHours: number;
    onlineBooking: boolean;
    bookingLeadDays: number;
    bookingHorizonDays: number;
};

const DAYS = [
    [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [7, "Sunday"],
] as const;

/**
 * The shape of the working day. These numbers are what "the diary is full"
 * is measured against, so they are worth getting right once.
 */
export function BookingSettingsForm({ tenant, diary }: { tenant: string; diary: DiaryForm }) {
    const [state, formAction, saving] = useActionState(saveDiarySettings.bind(null, tenant), initialActionState);
    const errors = state.errors;

    return (
        <form action={formAction} className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">Mechanics follow these hours unless their own are set under Diary → Hours &amp; leave.</p>
                <div className="flex items-center gap-3">
                    {state.message && <span className={state.ok ? "text-sm text-teal-700" : "text-sm text-red-600"} role={state.ok ? undefined : "alert"}>{state.message}</span>}
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
                </div>
            </div>

            <Section title="Opening hours">
                <TextField label="Opens" name="opensAt" type="time" errors={errors} defaultValue={diary.opensAt} />
                <TextField label="Closes" name="closesAt" type="time" errors={errors} defaultValue={diary.closesAt} />
                <div className="lg:col-span-2 space-y-1">
                    <p className="text-xs text-slate-600">Open on</p>
                    <div className="flex flex-wrap gap-2">
                        {DAYS.map(([value, label]) => (
                            <label key={value} className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-sm">
                                <input type="checkbox" name="workingDays" value={value} defaultChecked={diary.workingDays.includes(value)} className="accent-teal-600" />
                                {label.slice(0, 3)}
                            </label>
                        ))}
                    </div>
                    {errors?.workingDays && <p className="text-xs text-red-600">{errors.workingDays[0]}</p>}
                </div>
            </Section>

            <Section title="The diary">
                <SelectField label="Slot length" name="slotMinutes" errors={errors} defaultValue={String(diary.slotMinutes)} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "60", label: "1 hour" }]} />
                <TextField label="New booking length (hours)" name="defaultBookingHours" type="number" step="0.25" min="0.25" errors={errors} defaultValue={diary.defaultBookingHours} hint="Used when a job has no estimate" />
                <TextField label="Mechanics per page" name="lanesPerPage" type="number" min="1" max="8" errors={errors} defaultValue={diary.lanesPerPage} hint="Columns in the day view" />
                <TextField label="Full at (%)" name="fullAtPercent" type="number" min="50" max="100" errors={errors} defaultValue={diary.fullAtPercent} hint="Above this a day shows as full, and online booking stops offering it" />
            </Section>

            <Section title="Online booking">
                <div className="lg:col-span-4">
                    <CheckField
                        label="Let customers request bookings online"
                        name="onlineBooking"
                        defaultChecked={diary.onlineBooking}
                        hint={`At /${tenant}/book. Every request waits for approval — nothing lands in the diary on its own.`}
                    />
                </div>
                <TextField label="Earliest (days ahead)" name="bookingLeadDays" type="number" min="0" max="14" errors={errors} defaultValue={diary.bookingLeadDays} hint="1 means nothing for today" />
                <TextField label="Latest (days ahead)" name="bookingHorizonDays" type="number" min="7" max="90" errors={errors} defaultValue={diary.bookingHorizonDays} />
            </Section>
        </form>
    );
}
