const ULTRA_CONFIRMATION = "ENABLE ULTRA" as const;
const NETWORK_SESSION_PATH = /^\/api\/network\/sessions(?:\/[^/]+)?$/;
const NETWORK_APPROVAL_PATH = /^\/api\/network\/sessions\/[^/]+\/approvals\/[^/]+$/;

let installed = false;
let permissionToken: string | null = null;

/**
 * Installs a fail-closed browser boundary for network approvals and Ultra.
 *
 * The administrator token is requested through a browser prompt, retained only
 * in this module's memory and attached as a header. It is never written to
 * localStorage, the request body, chat context, RAG or application state.
 */
export function installNetworkPermissionGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const rawUrl = request ? request.url : input instanceof URL ? input.toString() : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (url.origin !== window.location.origin || method !== "POST" && method !== "PATCH") {
      return originalFetch(input, init);
    }

    const rawBody = init?.body ?? (request ? await request.clone().text() : undefined);
    const body = parseJsonObject(rawBody);
    const isUltraChange = NETWORK_SESSION_PATH.test(url.pathname) && body?.mode === "ultra";
    const isApproval = NETWORK_APPROVAL_PATH.test(url.pathname) && body?.decision === "approved";
    if (!isUltraChange && !isApproval) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? request?.headers);
    let nextBody = rawBody;

    if (isUltraChange && !hasValidUltraApproval(body?.ultraApproval)) {
      const entered = window.prompt(
        "Ultra giver denne midlertidige session adgang til alle offentlige HTTPS-kilder. Private netværk, metadata-endpoints og secrets er stadig blokeret. Skriv ENABLE ULTRA for at godkende.",
        "",
      );
      if (entered !== ULTRA_CONFIRMATION) {
        throw new DOMException("Ultra network access was not explicitly approved.", "NotAllowedError");
      }
      nextBody = JSON.stringify({
        ...body,
        ultraApproval: { confirmation: ULTRA_CONFIRMATION },
      });
      headers.set("Content-Type", "application/json");
    }

    if (!headers.has("X-Network-Permission-Token")) {
      const token = permissionToken ?? window.prompt(
        "Indtast NETWORK_PERMISSION_ADMIN_TOKEN. Tokenet holdes kun i browserens hukommelse og sendes ikke til AI-modellen.",
        "",
      );
      if (!token || token.trim().length < 24) {
        permissionToken = null;
        throw new DOMException("A valid network permission administrator token is required.", "NotAllowedError");
      }
      permissionToken = token.trim();
      headers.set("X-Network-Permission-Token", permissionToken);
      headers.set("X-Network-Permission-Actor", "interactive-browser-user");
    }

    const response = await originalFetch(input, {
      ...init,
      method,
      headers,
      ...(typeof nextBody === "string" ? { body: nextBody } : {}),
    });
    if (response.status === 401 || response.status === 403) permissionToken = null;
    return response;
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
  return approval.confirmation === ULTRA_CONFIRMATION;
}
