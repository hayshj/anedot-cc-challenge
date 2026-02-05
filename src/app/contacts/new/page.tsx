"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Json = any;

export default function NewContactPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<any>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setErrorDetails(null);

        const formData = new FormData(e.currentTarget);

        const email = str(formData.get("email"));
        const permissionToSend = str(formData.get("permission_to_send")) || "implicit";

        const first = str(formData.get("first_name"));
        const last = str(formData.get("last_name"));
        const jobTitle = str(formData.get("job_title"));
        const companyName = str(formData.get("company_name"));

        const createSource = str(formData.get("create_source")) || "Account";

        const birthdayMonth = numOrUndef(formData.get("birthday_month"));
        const birthdayDay = numOrUndef(formData.get("birthday_day"));

        const anniversary = str(formData.get("anniversary")) || undefined;

        // SMS inputs
        const smsFullAddress = str(formData.get("sms_full_address"));
        const smsConsentsRaw = str(formData.get("sms_channel_consents"));

        // Comma-separated fields
        const listMembershipsRaw = str(formData.get("list_memberships"));
        const taggingsRaw = str(formData.get("taggings"));

        // JSON fields (arrays)
        const customFieldsRaw = str(formData.get("custom_fields"));
        const phoneNumbersRaw = str(formData.get("phone_numbers"));
        const streetAddressesRaw = str(formData.get("street_addresses"));
        const notesRaw = str(formData.get("notes"));

        const hasAnySms =
            Boolean(smsFullAddress) ||
            (smsConsentsRaw && smsConsentsRaw.trim() !== "" && smsConsentsRaw.trim() !== "[]");

        // Validate: at least one of first_name, last_name, email_address, or sms_channel is required
        if (!first && !last && !email && !hasAnySms) {
            setLoading(false);
            setError(
                "At least one of First name, Last name, Email address, or SMS channel is required."
            );
            return;
        }

        // If email is provided, require explicit permission
        if (email && permissionToSend !== "explicit") {
            setLoading(false);
            setError(
                "If an Email Address is provided, Permission to send must be set to 'explicit' (per Constant Contact requirements)."
            );
            return;
        }

        // Birthday dependency (month/day must be together)
        if ((birthdayMonth && !birthdayDay) || (!birthdayMonth && birthdayDay)) {
            setLoading(false);
            setError("Birthday month and birthday day must be provided together.");
            return;
        }

        // Parse comma-separated fields into arrays
        const listMemberships = parseCommaSeparated(listMembershipsRaw);
        const taggings = parseCommaSeparated(taggingsRaw);

        // Parse JSON array fields
        let custom_fields: Json[] | undefined;
        let phone_numbers: Json[] | undefined;
        let street_addresses: Json[] | undefined;
        let notes: Json[] | undefined;
        let sms_channel_consents: Json[] | undefined;

        try {
            custom_fields = parseJsonArrayOrUndef(customFieldsRaw, "custom_fields");
            phone_numbers = parseJsonArrayOrUndef(phoneNumbersRaw, "phone_numbers");
            street_addresses = parseJsonArrayOrUndef(streetAddressesRaw, "street_addresses");
            notes = parseJsonArrayOrUndef(notesRaw, "notes");
            sms_channel_consents = parseJsonArrayOrUndef(smsConsentsRaw, "sms_channel_consents");
        } catch (err: any) {
            setLoading(false);
            setError(err?.message || "Invalid JSON in one of the JSON fields.");
            return;
        }

        // If any sms fields are provided, require non-empty consents array
        if (hasAnySms && (!sms_channel_consents || sms_channel_consents.length === 0)) {
            setLoading(false);
            setError(
                "If SMS fields are provided, SMS channel consents must be a non-empty JSON array (per Constant Contact requirements)."
            );
            return;
        }

        // Build payload (omit empties)
        const payload: any = {
            create_source: createSource,

            first_name: first || undefined,
            last_name: last || undefined,
            job_title: jobTitle || undefined,
            company_name: companyName || undefined,

            birthday_month: birthdayMonth ?? undefined,
            birthday_day: birthdayDay ?? undefined,
            anniversary,

            custom_fields: custom_fields?.length ? custom_fields : undefined,
            phone_numbers: phone_numbers?.length ? phone_numbers : undefined,
            street_addresses: street_addresses?.length ? street_addresses : undefined,
            notes: notes?.length ? notes : undefined,

            list_memberships: listMemberships.length ? listMemberships : undefined,
            taggings: taggings.length ? taggings : undefined,
        };

        if (email) {
            payload.email_address = {
                address: email,
                permission_to_send: permissionToSend,
            };
        }

        if (hasAnySms) {
            payload.sms_channel = {
                ...(smsFullAddress ? { sms_address: smsFullAddress } : {}),
                ...(sms_channel_consents?.length ? { sms_channel_consents } : {}),
            };
        }

        try {
            const res = await fetch("/api/contacts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok) {
                if (res.status === 409) {
                    throw new Error("That contact already exists (Conflict 409). Try a different email address.");
                }
                const errorMsg = json?.error || `Failed to create contact (${res.status})`;
                setError(errorMsg);
                if (json?.details) {
                    setErrorDetails(json.details);
                }
                setLoading(false);
                return;
            }

            router.push("/");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto p-6 sm:p-8 font-sans text-gray-900">
                <header className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create Contact</h1>
                            <p className="mt-2 text-gray-500">Use this form to capture the fields required for the exercise.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/"
                                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors shadow-sm"
                            >
                                View Contacts
                            </Link>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        <p className="font-medium">{error}</p>
                        {errorDetails && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                                    Show API error details
                                </summary>
                                <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-auto max-h-48">
                                    {typeof errorDetails === "string"
                                        ? errorDetails
                                        : JSON.stringify(errorDetails, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                )}

                <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 sm:p-10 shadow-sm border border-gray-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Row 1: Email address | Permission to send | First name */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Email address" name="email" type="email" />
                            <Select
                                label="Permission to send"
                                name="permission_to_send"
                                defaultValue="implicit"
                                options={[
                                    { value: "implicit", label: "implicit" },
                                    { value: "explicit", label: "explicit" },
                                ]}
                            />
                            <Input label="First name" name="first_name" />
                        </div>

                        {/* Row 2: Last name | Job title | Company name */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Last name" name="last_name" />
                            <Input label="Job title" name="job_title" />
                            <Input label="Company name" name="company_name" />
                        </div>

                        {/* Row 3: Create source | Birthday month | Birthday day */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select
                                label="Create source"
                                name="create_source"
                                defaultValue="Account"
                                options={[
                                    { value: "Account", label: "Account" },
                                    { value: "Contact", label: "Contact" },
                                ]}
                            />
                            <Input label="Birthday month" name="birthday_month" type="number" />
                            <Input label="Birthday day" name="birthday_day" type="number" />
                        </div>

                        {/* Row 4: Anniversary | SMS full address | SMS channel consents */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Anniversary" name="anniversary" type="date" />
                            <Input label="SMS full address" name="sms_full_address" />
                            <Textarea
                                label="SMS channel consents (JSON array)"
                                name="sms_channel_consents"
                                rows={3}
                                defaultValue="[]"
                            />
                        </div>

                        {/* Row 5: List memberships | Taggings | Custom fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="List memberships (comma separated)" name="list_memberships" />
                            <Input label="Taggings (comma separated)" name="taggings" />
                            <Textarea
                                label="Custom fields (JSON array)"
                                name="custom_fields"
                                rows={3}
                                defaultValue="[{}]"
                            />
                        </div>

                        {/* Row 6: Phone numbers | Street addresses | Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Textarea
                                label="Phone numbers (JSON array)"
                                name="phone_numbers"
                                rows={3}
                                defaultValue="[{}]"
                            />
                            <Textarea
                                label="Street addresses (JSON array)"
                                name="street_addresses"
                                rows={3}
                                defaultValue="[{}]"
                            />
                            <Textarea
                                label="Notes (JSON array)"
                                name="notes"
                                rows={3}
                                defaultValue="[{}]"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Saving..." : "Save contact"}
                            </button>
                            <Link
                                href="/"
                                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                View contacts
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}

/* ---------------------------- UI Components ---------------------------- */

function Input({
    label,
    name,
    type = "text",
    required,
    placeholder,
}: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                id={name}
                name={name}
                type={type}
                required={required}
                placeholder={placeholder}
                className="block w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6"
            />
        </div>
    );
}

function Textarea({
    label,
    name,
    placeholder,
    rows = 5,
    defaultValue,
}: {
    label: string;
    name: string;
    placeholder?: string;
    rows?: number;
    defaultValue?: string;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            <textarea
                id={name}
                name={name}
                rows={rows}
                placeholder={placeholder}
                defaultValue={defaultValue}
                className="block w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6 font-mono"
            />
        </div>
    );
}

function Select({
    label,
    name,
    options,
    defaultValue,
}: {
    label: string;
    name: string;
    options: { value: string; label: string }[];
    defaultValue?: string;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            <select
                id={name}
                name={name}
                defaultValue={defaultValue}
                className="block w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

/* ---------------------------- Helpers ---------------------------- */

function str(v: FormDataEntryValue | null) {
    return typeof v === "string" ? v.trim() : "";
}

function numOrUndef(v: FormDataEntryValue | null) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function parseCommaSeparated(raw: string): string[] {
    if (!raw || !raw.trim()) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseJsonArrayOrUndef(raw: string, fieldName: string) {
    const val = (raw || "").trim();
    if (!val || val === "[]" || val === "[{}]") return undefined;

    let parsed: any;
    try {
        parsed = JSON.parse(val);
    } catch {
        throw new Error(`${fieldName} must be valid JSON.`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error(`${fieldName} must be a JSON array (e.g. []).`);
    }
    // Filter out empty objects
    const filtered = parsed.filter((item: any) => {
        if (typeof item === "object" && item !== null) {
            return Object.keys(item).length > 0;
        }
        return true;
    });
    return filtered.length ? filtered : undefined;
}
