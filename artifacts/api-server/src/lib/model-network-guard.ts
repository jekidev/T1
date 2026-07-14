import { recordObservabilityEvent } from "./observability";

let installed = false;

/**
 * Prevents model-provider requests from smuggling internet search through an
 * "online" model or provider-specific web-search tool.
 *
 * Model inference transport remains allowed. External retrieval must happen
 * through the separate audited NetworkAccessSession boundary.
 */
export function installModelNetworkGuard(): void {
  if (installed) return;
  installed = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? (input instanceof URL ? input.toString() : input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (method === "POST" && /\/chat\/completions\/?$/i.test(url.pathname)) {
      const rawBody = init?.body ?? (request ? await request.clone().text() : undefined);
      const body = parseJsonObject(rawBody);
      const model = typeof body?.model === "string" ? body.model.trim() : "";
      const violation = modelViolation(model) ?? toolViolation(body);
      if (violation) {
        recordObservabilityEvent({
          source: "system",
          level: "warn",
          type: "llm.network_guard.blocked",
          message: "Blocked an LLM provider request with hidden or unaudited web access",
          data: {
            providerOrigin: url.origin,
            model,
            violation,
          },
        });
        throw new Error(
          `LLM network guard blocked ${model || "the configured model"}: ${violation}. `
          + "Use the audited Ask First/Ultra retrieval endpoints instead.",
        );
      }
    }

    return originalFetch(input, init);
  };
}

export function modelHasIntegratedWebAccess(modelInput: string): boolean {
  return modelViolation(modelInput) !== undefined;
}

function modelViolation(modelInput: string): string | undefined {
  const model = modelInput.toLowerCase();
  if (!model) return undefined;
  if (model.endsWith(":online") || model.includes("/online")) return "online model routing is not auditable";
  if (model.startsWith("perplexity/") || /(?:^|\/)sonar(?:-|$)/.test(model)) return "the selected model performs integrated web search";
  if (/(?:search[-_ ]preview|web[-_ ]search|internet[-_ ]search|grounded[-_ ]search)/.test(model)) {
    return "the model identifier advertises integrated search";
  }
  return undefined;
}

function toolViolation(body: Record<string, unknown> | undefined): string | undefined {
  if (!body) return undefined;
  const serialized = JSON.stringify({ tools: body.tools, plugins: body.plugins, web_search_options: body.web_search_options }).toLowerCase();
  if (/web[_-]?search|browser|url[_-]?fetch|internet[_-]?search|search[_-]?engine/.test(serialized)) {
    return "provider web-search/browser tools are forbidden outside the network gate";
  }
  return undefined;
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
