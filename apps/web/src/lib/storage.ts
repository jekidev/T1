import type { AppState } from "../types";
import { demoProject } from "../data/demo";

const KEY = "casecraft.state.v2";

export const defaultState: AppState = {
  projects: [demoProject()],
  ai: {
    chatProvider: "openrouter",
    chatModel: "openrouter/auto",
    rewriteModel: "openrouter/auto",
    analysisModel: "openrouter/auto",
    researchModel: "openrouter/auto",
    fallback: [],
    onlyFree: true,
    customBaseUrl: "",
    customModel: ""
  },
  tts: {
    provider: "browser",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3",
    speed: 1,
    maxChunkLength: 1800,
    customBaseUrl: ""
  },
  github: { owner: "", repo: "", branch: "main" },
  goals: { dailyWordGoal: 500, streak: 0 }
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...defaultState,
      ...parsed,
      ai: { ...defaultState.ai, ...parsed.ai },
      tts: { ...defaultState.tts, ...parsed.tts },
      github: { ...defaultState.github, ...parsed.github },
      goals: { ...defaultState.goals, ...parsed.goals }
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
