import { NextResponse } from "next/server";
import { ccFetchJson } from "@/lib/constantContact";

const ALLOWED_INCLUDE = new Set([
    "custom_fields",
    "list_memberships",
    "phone_numbers",
    "street_addresses",
    "taggings",
    "notes",
]);

const ALLOWED_STATUS = new Set([
    "all",
    "active",
    "deleted",
    "not_set",
    "pending_confirmation",
    "temp_hold",
    "unsubscribed",
]);

const ALLOWED_SMS_STATUS = new Set([
    "all",
    "explicit",
    "unsubscribed",
    "pending_confirmation",
    "not_set",
]);

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const sp = url.searchParams;

        const q: Record<string, string | number | boolean | undefined> = {};

        // limit: 1-500, default 50
        const limitRaw = sp.get("limit") ?? "50";
        const limit = clampInt(limitRaw, 1, 500);
        if (limit == null) {
            return NextResponse.json(
                { error: "Bad request: limit must be an integer between 1 and 500." },
                { status: 400 }
            );
        }
        q.limit = limit;

        // include_count: boolean
        const includeCountRaw = sp.get("include_count");
        if (includeCountRaw != null) {
            const b = parseBoolean(includeCountRaw);
            if (b == null) {
                return NextResponse.json(
                    { error: "Bad request: include_count must be true or false." },
                    { status: 400 }
                );
            }
            q.include_count = b;
        }

        // include: csv of subresources
        const includeRaw = sp.get("include");
        if (includeRaw) {
            const values = parseCsv(includeRaw);
            for (const v of values) {
                if (!ALLOWED_INCLUDE.has(v)) {
                    return NextResponse.json(
                        { error: `Bad request: invalid include "${v}".` },
                        { status: 400 }
                    );
                }
            }
            q.include = values.join(",");
        }

        // status: csv of status values
        const statusRaw = sp.get("status");
        if (statusRaw) {
            const values = parseCsv(statusRaw);
            for (const v of values) {
                if (!ALLOWED_STATUS.has(v)) {
                    return NextResponse.json(
                        { error: `Bad request: invalid status "${v}".` },
                        { status: 400 }
                    );
                }
            }
            q.status = values.join(",");
        }

        // email: specific email address search
        const emailRaw = sp.get("email");
        if (emailRaw && emailRaw.trim()) {
            q.email = emailRaw.trim();
        }

        // lists: up to 25 list_ids (comma separated)
        const listsRaw = sp.get("lists");
        if (listsRaw) {
            const values = parseCsv(listsRaw);
            if (values.length > 25) {
                return NextResponse.json(
                    { error: "Bad request: lists can have at most 25 items." },
                    { status: 400 }
                );
            }
            q.lists = values.join(",");
        }

        // segment_id: single segment ID (can only be combined with limit)
        const segmentIdRaw = sp.get("segment_id");
        if (segmentIdRaw && segmentIdRaw.trim()) {
            q.segment_id = segmentIdRaw.trim();
        }

        // tags: up to 50 tag_ids (comma separated)
        const tagsRaw = sp.get("tags");
        if (tagsRaw) {
            const values = parseCsv(tagsRaw);
            if (values.length > 50) {
                return NextResponse.json(
                    { error: "Bad request: tags can have at most 50 items." },
                    { status: 400 }
                );
            }
            q.tags = values.join(",");
        }

        // Date filters (ISO-8601 format)
        const dateParams = [
            "updated_after",
            "updated_before",
            "created_after",
            "created_before",
            "optout_after",
            "optout_before",
        ];
        for (const param of dateParams) {
            const val = sp.get(param);
            if (val && val.trim()) {
                q[param] = val.trim();
            }
        }

        // sms_status: csv of sms status values
        const smsStatusRaw = sp.get("sms_status");
        if (smsStatusRaw) {
            const values = parseCsv(smsStatusRaw);
            for (const v of values) {
                if (!ALLOWED_SMS_STATUS.has(v)) {
                    return NextResponse.json(
                        { error: `Bad request: invalid sms_status "${v}".` },
                        { status: 400 }
                    );
                }
            }
            q.sms_status = values.join(",");
        }

        const { status, data } = await ccFetchJson({
            path: "/contacts",
            query: q,
            method: "GET",
        });

        // Return response preserving status (200 or 202 for segment_id queries)
        return NextResponse.json(data, { status });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message ?? "Unknown error", details: e.details ?? null },
            { status: e.status ?? 500 }
        );
    }
}

/**
 * Create Contact
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Extract email - can come from various formats
        const email =
            typeof body?.email_address?.address === "string"
                ? body.email_address.address.trim()
                : typeof body?.email_address === "string"
                    ? body.email_address.trim()
                    : typeof body?.email === "string"
                        ? body.email.trim()
                        : "";

        // permission_to_send - check both top-level AND inside email_address
        const permission =
            typeof body?.permission_to_send === "string"
                ? body.permission_to_send.trim()
                : typeof body?.email_address?.permission_to_send === "string"
                    ? body.email_address.permission_to_send.trim()
                    : "";

        // If email is provided, permission_to_send is required
        if (email && !permission) {
            return NextResponse.json(
                { error: "Bad request: permission_to_send is required when email_address is provided." },
                { status: 400 }
            );
        }

        // list_memberships + taggings may come as CSV string from form inputs
        const listMemberships = parseCsvUuids(body?.list_memberships);
        const taggings = parseCsvUuids(body?.taggings);

        // JSON array fields may come as actual arrays OR as JSON strings like "[{}]" / "[]"
        const phoneNumbers = parseJsonArray(body?.phone_numbers);
        const streetAddresses = parseJsonArray(body?.street_addresses);
        const notes = parseJsonArray(body?.notes);
        const customFields = parseJsonArray(body?.custom_fields);
        const smsChannelConsents = parseJsonArray(body?.sms_channel_consents);

        // Handle sms_channel - can come from top level or nested inside sms_channel object
        const smsFullAddress =
            typeof body?.sms_full_address === "string"
                ? body.sms_full_address.trim()
                : typeof body?.sms_channel?.sms_address === "string"
                    ? body.sms_channel.sms_address.trim()
                    : "";

        // Also check for consents in the sms_channel object
        const smsChannelConsentsFromNested = body?.sms_channel?.sms_channel_consents;
        const finalSmsChannelConsents = smsChannelConsents.length > 0
            ? smsChannelConsents
            : parseJsonArray(smsChannelConsentsFromNested);

        // Enforce the rule you listed in your form:
        // If sms_full_address is provided, sms_channel_consents must be a non-empty array.
        if (smsFullAddress && finalSmsChannelConsents.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "Bad request: sms_channel_consents must be a non-empty JSON array when sms_full_address is provided.",
                },
                { status: 400 }
            );
        }

        // Birthday fields
        const birthdayMonth = typeof body?.birthday_month === "number"
            ? body.birthday_month
            : typeof body?.birthday_month === "string" && body.birthday_month.trim()
                ? parseInt(body.birthday_month, 10)
                : undefined;
        const birthdayDay = typeof body?.birthday_day === "number"
            ? body.birthday_day
            : typeof body?.birthday_day === "string" && body.birthday_day.trim()
                ? parseInt(body.birthday_day, 10)
                : undefined;

        // Anniversary field
        const anniversary = typeof body?.anniversary === "string" && body.anniversary.trim()
            ? body.anniversary.trim()
            : undefined;

        // Extract string fields with length limits per API docs
        const firstName = truncateStr(body?.first_name, 50);
        const lastName = truncateStr(body?.last_name, 50);
        const jobTitle = truncateStr(body?.job_title, 50);
        const companyName = truncateStr(body?.company_name, 50);

        // Validate: at least one of first_name, last_name, email_address, or sms_channel is required
        const hasSmsChannel = smsFullAddress || finalSmsChannelConsents.length > 0;
        if (!firstName && !lastName && !email && !hasSmsChannel) {
            return NextResponse.json(
                {
                    error:
                        "Bad request: At least one of first_name, last_name, email_address, or sms_channel is required.",
                },
                { status: 400 }
            );
        }

        // Validate array sizes per API limits
        if (phoneNumbers.length > 3) {
            return NextResponse.json(
                { error: "Bad request: phone_numbers can have at most 3 items." },
                { status: 400 }
            );
        }
        if (streetAddresses.length > 3) {
            return NextResponse.json(
                { error: "Bad request: street_addresses can have at most 3 items." },
                { status: 400 }
            );
        }
        if (customFields.length > 25) {
            return NextResponse.json(
                { error: "Bad request: custom_fields can have at most 25 items." },
                { status: 400 }
            );
        }
        if (notes.length > 150) {
            return NextResponse.json(
                { error: "Bad request: notes can have at most 150 items." },
                { status: 400 }
            );
        }
        if (listMemberships.length > 50) {
            return NextResponse.json(
                { error: "Bad request: list_memberships can have at most 50 items." },
                { status: 400 }
            );
        }
        if (taggings.length > 50) {
            return NextResponse.json(
                { error: "Bad request: taggings can have at most 50 items." },
                { status: 400 }
            );
        }

        // Build Constant Contact payload
        const payload: any = {
            create_source:
                typeof body?.create_source === "string" ? body.create_source : "Account",

            first_name: firstName || undefined,
            last_name: lastName || undefined,
            company_name: companyName || undefined,
            job_title: jobTitle || undefined,

            // Birthday and anniversary fields
            birthday_month: birthdayMonth,
            birthday_day: birthdayDay,
            anniversary: anniversary,

            // Arrays
            phone_numbers: phoneNumbers.length ? phoneNumbers : undefined,
            street_addresses: streetAddresses.length ? streetAddresses : undefined,
            notes: notes.length ? notes : undefined,
            custom_fields: customFields.length ? customFields : undefined,

            // CSV -> arrays
            list_memberships: listMemberships.length ? listMemberships : undefined,
            taggings: taggings.length ? taggings : undefined,
        };

        // Add email_address only if provided (with permission_to_send inside it per API spec)
        if (email) {
            payload.email_address = {
                address: email,
                permission_to_send: permission,
            };
        }

        // Add SMS channel if present (Constant Contact expects this structure)
        if (hasSmsChannel) {
            // Format SMS address to E.164 format (prepend + if missing)
            const formattedSmsAddress = smsFullAddress
                ? (smsFullAddress.startsWith('+') ? smsFullAddress : `+${smsFullAddress}`)
                : undefined;
            payload.sms_channel = {
                full_sms_address: formattedSmsAddress,
                sms_channel_consents: finalSmsChannelConsents.length ? finalSmsChannelConsents : undefined,
            };
        }

        // Remove undefined keys so we don't send junk upstream
        for (const k of Object.keys(payload)) {
            if (payload[k] === undefined) delete payload[k];
        }

        const { status, data } = await ccFetchJson({
            path: "/contacts",
            method: "POST",
            body: payload,
        });

        return NextResponse.json(data, { status: status ?? 201 });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message ?? "Unknown error", details: e.details ?? null },
            { status: e.status ?? 500 }
        );
    }
}

function parseCsv(v: string): string[] {
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseCsvUuids(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof value !== "string") return [];
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseJsonArray(value: unknown): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseBoolean(v: string): boolean | null {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    return null;
}

function clampInt(v: string, min: number, max: number): number | null {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return null;
    if (n < min || n > max) return null;
    return n;
}

function truncateStr(value: unknown, maxLen: number): string {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}
