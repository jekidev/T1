const ULTRA_CONFIRMATION = "ENABLE ULTRA" as const;
const NETWORK_SESSION_PATH = /^\/api\/network\/sessions(?:\/[^/]+)?$/;

let installed = false;

/**
 * Installs a fail-closed browser boundary for Ultra network sessions.
 *
 * Every same-origin POST/PATCH that creates or upgrades a network session to
 * Ultra must contain a fresh user-entered confirmation. The guard inserts the
 * server-validated approval object only after the exact phrase is entered.
 * LLM responses, AI profiles and background code cannot silently toggle it.
 */
export function installNetworkPermissionGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(
      request?.url ?? (input instanceof URL ? input.toString() : input),
      window.location.href,
    );
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (
      url.origin === window.location.origin
      && NETWORK_SESSION_PATH.test(url.pathname)
      && (method === "POST" || method === "PATCH")
    ) {
      const rawBody = init?.body ?? (request && method !== "GET" && method !== "HEAD" ? await request.clone().text() : undefined);
      const body = parseJsonObject(rawBody);
      if (body?.mode === "ultra" && !hasValidUltraApproval(body.ultraApproval)) {
        const entered = window.prompt(
          "Ultra giver denne midlertidige session adgang til alle offentlige HTTPS-kilder. Private netværk, metadata-endpoints og secrets er stadig blokeret. Skriv ENABLE ULTRA for at godkende.",
          "",
        );
        if (entered !== ULTRA_CONFIRMATION) {
          throw new DOMException("Ultra network access was not explicitly approved.", "NotAllowedError");
        }

        const nextBody = JSON.stringify({
          ...body,
          ultraApproval: {
            approvedBy: "interactive-browser-user",
            confirmation: ULTRA_CONFIRMATION,
          },
        });
        const headers = new Headers(init?.headers ?? request?.headers);
        headers.set("Content-Type", "application/json");
        return originalFetch(input, { ...init, method, headers, body: nextBody });
      }
    }

    return originalFetch(input, init);
  };
}

function parseJsonObject(body: BodyInit | null | undefined): Record<string, unknown> | undefined {
  if (typeof body !== "string") return undefined;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function hasValidUltraApproval(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const approval = value as Record<string, unknown>;
  return approval.confirmation === ULTRA_CONFIRMATION
    && typeof approval.approvedBy === "string"
    && approval.approvedBy.trim().length > 0;
}
