export type ObservabilityLevel = "debug" | "info" | "warn" | "error";

export interface ObservabilityEvent {
  id: string;
  timestamp: string;
  source: "browser" | "server" | "game" | "system";
  level: ObservabilityLevel;
  type: string;
  message: string;
  data?: unknown;
}

const MAX_EVENTS = 500;
const events: ObservabilityEvent[] = [];
const listeners = new Set<(event: ObservabilityEvent) => void>();

function safeData(data: unknown): unknown {
  if (data === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return { serializationError: true };
  }
}

export function recordObservabilityEvent(
  event: Omit<ObservabilityEvent, "id" | "timestamp">,
): ObservabilityEvent {
  const entry: ObservabilityEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    data: safeData(event.data),
  };

  events.push(entry);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  for (const listener of listeners) listener(entry);
  return entry;
}

export function listObservabilityEvents(limit = 100): ObservabilityEvent[] {
  const bounded = Math.max(1, Math.min(limit, MAX_EVENTS));
  return events.slice(-bounded);
}

export function subscribeToObservability(
  listener: (event: ObservabilityEvent) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
