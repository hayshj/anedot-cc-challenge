type FetchOpts = {
    method?: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
};

type CcTokenResponse = {
    access_token: string;
    refresh_token?: string; // may be present depending on refresh token type
    expires_in?: number;
    token_type?: string;
};

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable: ${name}`);
    return v;
}

// Keep the latest working access token in memory so refresh doesn't require editing .env.local
let accessTokenCache: string | null = process.env.CC_ACCESS_TOKEN ?? null;

// Prevent multiple simultaneous refreshes from spamming token endpoint
let refreshInFlight: Promise<string> | null = null;

export async function ccFetchJson(opts: FetchOpts) {
    const baseUrl = requireEnv("CC_BASE_URL");

    // 1) attempt with cached token
    try {
        return await ccFetchJsonWithToken(baseUrl, getAccessToken(), opts);
    } catch (e: any) {
        // Only attempt refresh on 401, then retry once
        if (e?.status === 401) {
            const newToken = await refreshAccessToken();
            return await ccFetchJsonWithToken(baseUrl, newToken, opts);
        }
        throw e;
    }
}

function getAccessToken(): string {
    if (!accessTokenCache) {
        // fall back to env if cache cleared for some reason
        accessTokenCache = process.env.CC_ACCESS_TOKEN ?? null;
    }
    if (!accessTokenCache) {
        throw new Error("Missing environment variable: CC_ACCESS_TOKEN");
    }
    return accessTokenCache;
}

async function ccFetchJsonWithToken(baseUrl: string, token: string, opts: FetchOpts) {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}${opts.path}`);

    if (opts.query) {
        for (const [k, v] of Object.entries(opts.query)) {
            if (v !== undefined) url.searchParams.set(k, String(v));
        }
    }

    const res = await fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    // res.ok is true for 200–299 (including 202)
    if (!res.ok) {
        const message =
            (data && (data.message || data.error || data.title || data.error_message)) ||
            `Constant Contact API error (${res.status})`;
        const err = new Error(message) as Error & { status?: number; details?: unknown };
        err.status = res.status;
        err.details = data ?? text;
        throw err;
    }

    return { status: res.status, data: data ?? {} };
}

async function refreshAccessToken(): Promise<string> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        const clientId = requireEnv("CC_CLIENT_ID");
        const refreshToken = requireEnv("CC_REFRESH_TOKEN");

        const res = await fetch("https://authz.constantcontact.com/oauth2/default/v1/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
            }).toString(),
            cache: "no-store",
        });

        const text = await res.text();
        const json = text ? safeJson(text) : null;

        if (!res.ok) {
            const message =
                (json && (json.error_description || json.error || json.message)) ||
                `Failed to refresh Constant Contact token (${res.status})`;
            const err = new Error(message) as Error & { status?: number; details?: unknown };
            err.status = res.status;
            err.details = json ?? text;
            throw err;
        }

        const tokenResp = (json ?? {}) as CcTokenResponse;
        if (!tokenResp.access_token) {
            throw new Error("Token refresh succeeded but no access_token was returned.");
        }

        // Update in-memory access token
        accessTokenCache = tokenResp.access_token;

        // If using rotating refresh tokens and CC returns a new refresh token, we cannot safely persist it
        // without storage. For the take-home, we keep using the original CC_REFRESH_TOKEN from env.
        // (If you switch to rotating refresh tokens, add persistent storage for refresh_token.)
        return accessTokenCache;
    })();

    try {
        return await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
}

function safeJson(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
