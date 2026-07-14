// Minimal direct OpenRouter client. This project's managed AI Integrations
// connector was unavailable for this account, so the AI advisor uses the
// user's own OPENROUTER_API_KEY against OpenRouter's public API directly.

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterModel {
  id: string;
}

let cachedModelId: string | null = null;

function apiKey(): string {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return key;
}

async function resolveModelId(): Promise<string> {
  if (cachedModelId) return cachedModelId;

  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list OpenRouter models: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: OpenRouterModel[] };
  const models = data.data ?? [];

  const preferredPrefixes = ["openai/gpt-4o-mini", "openai/", "anthropic/", "google/"];
  let chosen: OpenRouterModel | undefined;
  for (const prefix of preferredPrefixes) {
    chosen = models.find((m) => m.id.startsWith(prefix));
    if (chosen) break;
  }
  chosen = chosen ?? models[0];
  if (!chosen) {
    throw new Error("No models available from OpenRouter");
  }
  cachedModelId = chosen.id;
  return cachedModelId;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatWithOpenRouter(messages: ChatMessage[]): Promise<string> {
  const model = await resolveModelId();
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.6 }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter chat request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter response did not include a message");
  }
  return content;
}
