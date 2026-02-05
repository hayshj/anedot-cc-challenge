export async function refreshConstantContactToken() {
    const res = await fetch(
        "https://authz.constantcontact.com/oauth2/default/v1/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: process.env.CC_REFRESH_TOKEN!,
                client_id: process.env.CC_CLIENT_ID!,
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to refresh token (${res.status}): ${text}`);
    }

    return res.json() as Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    }>;
}
