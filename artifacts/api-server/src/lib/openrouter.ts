import { recordObservabilityEvent } from "./observability";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429]);

export const DEFAULT_ROTATION_MODELS = [
  "nvidia/nemotron-nano-9b-v2:free",
  "google/gemma-4-26b-a4b-it:free",
  "mistralai/mistral-nemo",
] as const;

export type LlmRoutingMode = "rotate" | "static" | "off";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterModel {
  id: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    request?: string | number;
  };
}

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: Record<string, unknown>;
}

interface RouteAttempt {
  model: string;
  keyIndex: number;
  status?: number;
  error: string;
  retry: number;
}

export interface LlmRouterStatus {
  configured: boolean;
  mode: LlmRoutingMode;
  enabled: boolean;
  keyCount: number;
  activeModels: string[];
  staticModel: string;
  configuredModels: string[];
  cachedDiscoveredModels: string[];
  cooldownRoutes: number;
  lastSuccessfulModel: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
}

const cooldowns = new Map<string, number>();
let modelIndex = 0;
let keyIndex = 0;
let discoveredModels: string[] = [];
let discoveredAt = 0;
let lastSuccessfulModel: string | null = null;
let lastFailureAt: string | null = null;
let lastSuccessAt: string | null = null;

function csv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function routingMode(): LlmRoutingMode {
  const value = (process.env.LLM_ROUTING_MODE ?? "rotate").trim().toLowerCase();
  return value === "static" || value === "off" ? value : "rotate";
}

function staticModel(): string {
  return process.env.LLM_STATIC_MODEL?.trim() || DEFAULT_ROTATION_MODELS[0];
}

function apiKeys(): string[] {
  const keys = csv("OPENROUTER_API_KEYS");
  const single = process.env.OPENROUTER_API_KEY?.trim();
  if (single && !keys.includes(single)) keys.push(single);
  if (keys.length === 0) throw new Error("Set OPENROUTER_API_KEY or OPENROUTER_API_KEYS");
  return keys;
}

function ordered<T>(values: T[], start: number): T[] {
  if (values.length === 0) return [];
  const offset = ((start % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function isFree(model: OpenRouterModel): boolean {
  const pricing = model.pricing ?? {};
  return [pricing.prompt, pricing.completion, pricing.request].every((value) => Number(value ?? 0) === 0);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverModels(keys: string[]): Promise<string[]> {
  const mode = routingMode();
  if (mode === "off") return [];
  if (mode === "static") return [staticModel()];

  const configured = csv("OPENROUTER_MODELS");
  if (configured.length > 0) return configured;

  if (!envBoolean("OPENROUTER_AUTO_DISCOVER", false)) {
    return [...DEFAULT_ROTATION_MODELS];
  }

  const cacheMs = envNumber("OPENROUTER_MODEL_CACHE_MS", 15 * 60 * 1000);
  if (discoveredModels.length > 0 && Date.now() - discoveredAt < cacheMs) return discoveredModels;

  const baseUrl = (process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetchWithTimeout(
    `${baseUrl}/models`,
    { headers: { Authorization: `Bearer ${keys[0]}` } },
    envNumber("OPENROUTER_TIMEOUT_MS", 45_000),
  );
  if (!response.ok) throw new Error(`Failed to list OpenRouter models: ${response.status}`);

  const body = (await response.json()) as { data?: OpenRouterModel[] };
  let models = body.data ?? [];
  if (envBoolean("OPENROUTER_FREE_ONLY", true)) models = models.filter(isFree);
  models.sort((a, b) => Number(b.context_length ?? 0) - Number(a.context_length ?? 0));

  const limit = Math.max(1, envNumber("OPENROUTER_MODEL_LIMIT", 30));
  discoveredModels = models.map((model) => model.id).filter(Boolean).slice(0, limit);
  discoveredAt = Date.now();

  if (discoveredModels.length === 0) throw new Error("No OpenRouter models are available");
  return discoveredModels;
}

function retryable(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

function routeId(model: string, key: string): string {
  return `${model}:${key.slice(-8)}`;
}

function cleanCooldowns() {
  const now = Date.now();
  for (const [route, until] of cooldowns) if (until <= now) cooldowns.delete(route);
}

function activeModelsForStatus(): string[] {
  const mode = routingMode();
  if (mode === "off") return [];
  if (mode === "static") return [staticModel()];
  const configured = csv("OPENROUTER_MODELS");
  return configured.length > 0 ? configured : [...DEFAULT_ROTATION_MODELS];
}

export function getLlmRouterStatus(): LlmRouterStatus {
  cleanCooldowns();
  const configuredKeys = csv("OPENROUTER_API_KEYS");
  if (process.env.OPENROUTER_API_KEY?.trim()) configuredKeys.push(process.env.OPENROUTER_API_KEY.trim());
  const mode = routingMode();
  return {
    configured: configuredKeys.length > 0,
    mode,
    enabled: mode !== "off",
    keyCount: new Set(configuredKeys).size,
    activeModels: activeModelsForStatus(),
    staticModel: staticModel(),
    configuredModels: csv("OPENROUTER_MODELS"),
    cachedDiscoveredModels: discoveredModels,
    cooldownRoutes: cooldowns.size,
    lastSuccessfulModel,
    lastFailureAt,
    lastSuccessAt,
  };
}

export async function chatWithOpenRouter(messages: ChatMessage[]): Promise<string> {
  const mode = routingMode();
  if (mode === "off") {
    recordObservabilityEvent({
      source: "system",
      level: "info",
      type: "llm.disabled",
      message: "External LLM routing is disabled; local fallback will be used",
      data: { mode },
    });
    throw new Error("External LLM routing is disabled");
  }

  const keys = apiKeys();
  const models = await discoverModels(keys);
  const orderedModels = mode === "static" ? models : ordered(models, modelIndex);
  const orderedKeys = ordered(keys, keyIndex);
  const attempts: RouteAttempt[] = [];
  const baseUrl = (process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const retries = Math.max(0, envNumber("OPENROUTER_RETRIES", 1));
  const cooldownMs = Math.max(1_000, envNumber("OPENROUTER_COOLDOWN_MS", 60_000));
  const timeoutMs = Math.max(1_000, envNumber("OPENROUTER_TIMEOUT_MS", 45_000));

  cleanCooldowns();

  for (const model of orderedModels) {
    for (const key of orderedKeys) {
      const route = routeId(model, key);
      if ((cooldowns.get(route) ?? 0) > Date.now()) continue;

      for (let retry = 0; retry <= retries; retry += 1) {
        try {
          const response = await fetchWithTimeout(
            `${baseUrl}/chat/completions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                "X-Title": process.env.OPENROUTER_APP_NAME ?? "Urban Strategy Simulator",
                ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
              },
              body: JSON.stringify({
                model,
                messages: messages.slice(-40).map((message) => ({
                  role: message.role,
                  content: message.content.slice(0, 30_000),
                })),
                max_tokens: envNumber("OPENROUTER_MAX_TOKENS", 1_400),
                temperature: envNumber("OPENROUTER_TEMPERATURE", 0.6),
              }),
            },
            timeoutMs,
          );

          if (!response.ok) {
            const text = (await response.text()).slice(0, 1_000);
            if (retryable(response.status)) throw Object.assign(new Error(text || `HTTP ${response.status}`), { status: response.status });
            throw Object.assign(new Error(text || `HTTP ${response.status}`), { status: response.status, permanent: true });
          }

          const data = (await response.json()) as OpenRouterResponse;
          const content = data.choices?.[0]?.message?.content?.trim();
          if (!content) throw new Error("OpenRouter response did not include content");

          if (mode === "rotate") modelIndex = (models.indexOf(model) + 1) % models.length;
          keyIndex = (keys.indexOf(key) + 1) % keys.length;
          lastSuccessfulModel = data.model ?? model;
          lastSuccessAt = new Date().toISOString();

          recordObservabilityEvent({
            source: "system",
            level: "info",
            type: "llm.route.success",
            message: `LLM request succeeded with ${lastSuccessfulModel}`,
            data: { mode, model: lastSuccessfulModel, keyIndex: keys.indexOf(key), retry, usage: data.usage ?? {} },
          });

          return content;
        } catch (error) {
          const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : undefined;
          const permanent = Boolean(typeof error === "object" && error && "permanent" in error && (error as { permanent?: boolean }).permanent);
          const message = error instanceof Error ? error.message : String(error);
          attempts.push({ model, keyIndex: keys.indexOf(key), status, error: message, retry });

          if (permanent || retry >= retries) break;
          await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** retry));
        }
      }

      cooldowns.set(route, Date.now() + cooldownMs);
      recordObservabilityEvent({
        source: "system",
        level: "warn",
        type: "llm.route.cooldown",
        message: `LLM route placed on cooldown for ${model}`,
        data: { mode, model, keyIndex: keys.indexOf(key), cooldownMs },
      });
    }
  }

  lastFailureAt = new Date().toISOString();
  recordObservabilityEvent({
    source: "system",
    level: "error",
    type: "llm.all_routes_failed",
    message: "All configured OpenRouter routes failed",
    data: { mode, attempts: attempts.slice(-12) },
  });

  const summary = attempts.slice(-8).map((attempt) => `${attempt.model}[key ${attempt.keyIndex}] ${attempt.status ?? "network"}: ${attempt.error}`).join(" | ");
  throw new Error(`All configured OpenRouter routes failed. ${summary}`);
}
