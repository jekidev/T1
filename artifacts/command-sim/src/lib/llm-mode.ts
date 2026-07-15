import { useEffect, useState } from "react";

export type LlmUserMode = "light" | "balanced" | "uber";

export const LLM_MODE_STORAGE_KEY = "t1-llm-user-mode";
export const LLM_MODE_EVENT = "t1:llm-mode-changed";

export const LLM_MODE_META: Record<LlmUserMode, { label: string; short: string; advisorInstruction: string }> = {
  light: {
    label: "Light",
    short: "Hourly wisdom only",
    advisorInstruction: "LIGHT MODE: Be concise, calm and user-led. Do not proactively critique normal play. Give one next step at most.",
  },
  balanced: {
    label: "Balanced",
    short: "Wisdom + turn coaching",
    advisorInstruction: "BALANCED MODE: Give a measured analysis with key trade-offs, one risk and one practical next step.",
  },
  uber: {
    label: "Uber",
    short: "Live copilot + PR proposals",
    advisorInstruction: "UBER MODE: Act as an active game-development copilot. Comment on observed behavior and state changes in real time, distinguish facts from inference, and propose reversible code improvements without claiming they were applied.",
  },
};

export function loadLlmMode(): LlmUserMode {
  if (typeof window === "undefined") return "balanced";
  const stored = window.localStorage.getItem(LLM_MODE_STORAGE_KEY);
  return stored === "light" || stored === "uber" ? stored : "balanced";
}

export function saveLlmMode(mode: LlmUserMode): void {
  window.localStorage.setItem(LLM_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(LLM_MODE_EVENT, { detail: mode }));
}

export function useLlmMode(): [LlmUserMode, (mode: LlmUserMode) => void] {
  const [mode, setModeState] = useState<LlmUserMode>(() => loadLlmMode());

  useEffect(() => {
    const onMode = (event: Event) => {
      const detail = (event as CustomEvent<LlmUserMode>).detail;
      setModeState(detail === "light" || detail === "uber" ? detail : "balanced");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LLM_MODE_STORAGE_KEY) setModeState(loadLlmMode());
    };
    window.addEventListener(LLM_MODE_EVENT, onMode);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LLM_MODE_EVENT, onMode);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [mode, (next) => { saveLlmMode(next); setModeState(next); }];
}
