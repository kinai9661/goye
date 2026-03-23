const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BEARER_TOKEN = process.env.API_BEARER_TOKEN;

function ensureBackendBaseUrl(): string {
  if (!BACKEND_BASE_URL) {
    throw new Error("Missing BACKEND_BASE_URL or NEXT_PUBLIC_API_BASE_URL");
  }
  return BACKEND_BASE_URL;
}

export async function forwardToBackend(path: string, init?: RequestInit): Promise<Response> {
  const base = ensureBackendBaseUrl();
  const headers = new Headers(init?.headers || {});

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (API_BEARER_TOKEN) {
    headers.set("Authorization", `Bearer ${API_BEARER_TOKEN}`);
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
