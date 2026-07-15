import { H } from "highlight.run";
import { record } from "rrweb";

export type ReplayConsent = "granted" | "denied" | null;
export type ReplayProvider = "highlight" | "rrweb" | "disabled";

const CONSENT_KEY = "operation-kobenhavn-observability-consent";
const SESSION_ID_KEY = "operation-kobenhavn-replay-session-id";
const MAX_BATCH_EVENTS = 100;
const FLUSH_INTERVAL_MS = 5_000;

let provider: ReplayProvider = "disabled";
let stopRecording: (() => void) | undefined;
let flushTimer: number | undefined;
let rrwebQueue: unknown[] = [];
let highlightInitialized = false;

export function getReplayConsent(): ReplayConsent {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function setReplayConsent(consent: Exclude<ReplayConsent, null>): void {
  window.localStorage.setItem(CONSENT_KEY, consent);
  if (consent === "granted") {
    void startSessionReplay();
  } else {
    stopSessionReplay();
  }
  window.dispatchEvent(new CustomEvent("operation-observability-consent", { detail: consent }));
}

export function getReplayProvider(): ReplayProvider {
  return provider;
}

export async function startSessionReplay(): Promise<ReplayProvider> {
  if (typeof window === "undefined" || getReplayConsent() !== "granted") return "disabled";
  if (provider !== "disabled") return provider;

  const projectId = import.meta.env.VITE_HIGHLIGHT_PROJECT_ID?.trim();
  if (projectId) {
    if (!highlightInitialized) {
      H.init(projectId, {
        manualStart: true,
        privacySetting: "strict",
        disableConsoleRecording: true,
        enableCanvasRecording: false,
        enablePerformanceRecording: true,
        inlineImages: false,
        tracingOrigins: [window.location.origin, /^\//],
        networkRecording: {
          enabled: true,
          recordHeadersAndBody: false,
          urlBlocklist: [
            "/api/asset-generation/worker",
            "/api/observability/replay",
            ".env",
            "authorization",
            "api-key",
            "token",
          ],
        },
        serviceName: "operation-kobenhavn-web",
        environment: import.meta.env.MODE,
        storageMode: "sessionStorage",
        otel: { instrumentations: {} },
      });
      highlightInitialized = true;
    }
    H.start();
    provider = "highlight";
    return provider;
  }

  if (import.meta.env.VITE_SESSION_REPLAY_FALLBACK !== "rrweb") return "disabled";
  const stop = record({
    emit(event) {
      rrwebQueue.push(event);
      if (rrwebQueue.length >= MAX_BATCH_EVENTS) void flushRrweb();
    },
    maskAllInputs: true,
    blockSelector: [
      "[data-replay-block]",
      ".monaco-editor",
      "input[type='password']",
      "[data-secret]",
      "[data-token]",
      "[data-api-key]",
      "canvas",
    ].join(","),
    maskTextSelector: "[data-replay-mask], [data-private]",
    inlineImages: false,
    recordCanvas: false,
    collectFonts: false,
    sampling: {
      mousemove: 100,
      mouseInteraction: true,
      scroll: 150,
      input: "last",
    },
  });
  stopRecording = typeof stop === "function" ? stop : undefined;
  flushTimer = window.setInterval(() => void flushRrweb(), FLUSH_INTERVAL_MS);
  provider = "rrweb";
  return provider;
}

export function stopSessionReplay(): void {
  if (provider === "highlight") H.stop();
  stopRecording?.();
  stopRecording = undefined;
  if (flushTimer !== undefined) window.clearInterval(flushTimer);
  flushTimer = undefined;
  if (rrwebQueue.length > 0) void flushRrweb();
  provider = "disabled";
}

export function installReplayPrivacyMarkers(root: ParentNode = document): () => void {
  const mark = () => {
    root.querySelectorAll(".monaco-editor, [data-secret], [data-token], [data-api-key]").forEach(element => {
      element.setAttribute("data-replay-block", "true");
    });
    root.querySelectorAll("input[type='password'], input[name*='token' i], input[name*='secret' i], input[name*='key' i]").forEach(element => {
      element.setAttribute("data-replay-block", "true");
    });
  };
  mark();
  const observer = new MutationObserver(mark);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

async function flushRrweb(): Promise<void> {
  if (rrwebQueue.length === 0) return;
  const events = rrwebQueue.splice(0, MAX_BATCH_EVENTS);
  const sessionId = getOrCreateSessionId();
  try {
    const response = await window.fetch(`/api/observability/replay/${encodeURIComponent(sessionId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "rrweb",
        path: window.location.pathname,
        events,
      }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Replay ingest failed with HTTP ${response.status}.`);
  } catch {
    rrwebQueue.unshift(...events.slice(-MAX_BATCH_EVENTS));
  }
}

function getOrCreateSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const value = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(SESSION_ID_KEY, value);
  return value;
}
