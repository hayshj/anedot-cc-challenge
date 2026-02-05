export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
        const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        throw new Error(message);
    }

    return data as T;
}

function safeJson(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
