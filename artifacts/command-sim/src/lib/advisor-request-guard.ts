import { buildLlmWorkspaceContext } from "./workspace";

const ADVISOR_CHAT_PATH = /\/api\/advisor\/chat\/?$/;
const CONTEXT_MARKER = "LLM WORKSPACE AUTHORITY:";
let installed = false;

/**
 * Makes Talk / Plan / Build and the selected LLM moral stance authoritative.
 *
 * The visual mode selector and the actual advisor request cannot drift apart:
 * every same-origin advisor request is enriched immediately before transport.
 */
export function installAdvisorRequestGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const rawUrl = request ? request.url : input instanceof URL ? input.toString() : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (url.origin !== window.location.origin || method !== "POST" || !ADVISOR_CHAT_PATH.test(url.pathname)) {
      return originalFetch(input, init);
    }

    const rawBody = init?.body ?? (request ? await request.clone().text() : undefined);
    if (typeof rawBody !== "string") return originalFetch(input, init);

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return originalFetch(input, init);
      body = parsed as Record<string, unknown>;
    } catch {
      return originalFetch(input, init);
    }

    const message = typeof body.message === "string" ? body.message : "";
    if (!message.includes(CONTEXT_MARKER)) {
      body.message = `${buildLlmWorkspaceContext()}\n\nCURRENT USER REQUEST:\n${message}`;
    }

    const headers = new Headers(init?.headers ?? request?.headers);
    headers.set("Content-Type", "application/json");
    return originalFetch(input, {
      ...init,
      method,
      headers,
      body: JSON.stringify(body),
    });
  };
}
