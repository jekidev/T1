import type { ProviderId } from "../types";

async function parseError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { error?: string };
    return new Error(body.error || `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}`);
  }
}

export async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export interface SecretStatus {
  provider: ProviderId;
  configured: boolean;
  last4?: string;
}

export const secretsApi = {
  list: () => apiJson<{ secureStorage: boolean; statuses: SecretStatus[] }>("/api/secrets/status"),
  save: (provider: ProviderId, apiKey: string) =>
    apiJson<{ ok: true }>(`/api/secrets/${provider}`, { method: "PUT", body: JSON.stringify({ apiKey }) }),
  remove: (provider: ProviderId) =>
    apiJson<{ ok: true }>(`/api/secrets/${provider}`, { method: "DELETE" }),
  test: (provider: ProviderId, options: Record<string, string> = {}) =>
    apiJson<{ ok: boolean; message: string }>(`/api/secrets/${provider}/test`, {
      method: "POST",
      body: JSON.stringify(options)
    })
};

export async function generateTts(payload: Record<string, unknown>): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw await parseError(response);
  return response.blob();
}
