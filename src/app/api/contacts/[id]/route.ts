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

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // 400 – validate contact_id (basic UUID sanity check)
        if (!looksUuid(id)) {
            return NextResponse.json(
                { error: "Bad request: contact_id must be a UUID." },
                { status: 400 }
            );
        }

        // include: optional csv with only allowed values
        const url = new URL(req.url);
        const includeRaw = url.searchParams.get("include");

        let include: string | undefined;

        if (includeRaw != null) {
            const values = parseCsv(includeRaw);

            if (values.length === 0) {
                return NextResponse.json(
                    { error: 'Bad request: include cannot be empty. Example: include=phone_numbers,street_addresses' },
                    { status: 400 }
                );
            }

            for (const v of values) {
                if (!ALLOWED_INCLUDE.has(v)) {
                    return NextResponse.json(
                        { error: `Bad request: invalid include "${v}".` },
                        { status: 400 }
                    );
                }
            }

            include = values.join(",");
        }

        // Call Constant Contact
        const { status, data } = await ccFetchJson({
            path: `/contacts/${encodeURIComponent(id)}`,
            query: include ? { include } : undefined,
        });

        // Preserve status (should be 200 on success)
        return NextResponse.json(data, { status });
    } catch (e: any) {
        // Pass through CC error status codes (401/403/404/500/503/etc.)
        return NextResponse.json(
            { error: e.message ?? "Unknown error", details: e.details ?? null },
            { status: e.status ?? 500 }
        );
    }
}

/* ---------------- helpers ---------------- */

function parseCsv(v: string): string[] {
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function looksUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}
