import type { ChatMessage } from "./openrouter";
import { DEFAULT_ROTATION_MODELS } from "./openrouter";
import { recordObservabilityEvent } from "./observability";

export async function chatWithWorkspaceOpenRouter(messages: ChatMessage[], apiKey: string): Promise<string> {
  const model = process.env.LLM_STATIC_MODEL?.trim() || process.env.OPENROUTER_WORKSPACE_MODEL?.trim() || DEFAULT_ROTATION_MODELS[0];
  const baseUrl = (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45_000));
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Urban Strategy Simulator",
        ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
      },
      body: JSON.stringify({
        model,
        messages: messages.slice(-40).map(message => ({ role: message.role, content: message.content.slice(0, 30_000) })),
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 1_800),
        temperature: Number(process.env.OPENROUTER_TEMPERATURE ?? 0.6),
      }),
    });
    if (!response.ok) throw new Error((await response.text()).slice(0, 1000) || `OpenRouter HTTP ${response.status}`);
    const body = await response.json() as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenRouter workspace response did not include content.");
    recordObservabilityEvent({ source: "system", level: "info", type: "llm.workspace.success", message: `Workspace LLM request succeeded with ${body.model ?? model}`, data: { model: body.model ?? model } });
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
