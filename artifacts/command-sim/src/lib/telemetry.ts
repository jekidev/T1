import { useBoardStore } from '@/lib/game';
import {
  getReplayConsent,
  installReplayPrivacyMarkers,
  startSessionReplay,
  stopSessionReplay,
} from '@/lib/session-replay';

type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';
type TelemetrySource = 'browser' | 'game';

export interface TelemetryInput {
  source: TelemetrySource;
  level: TelemetryLevel;
  type: string;
  message: string;
  data?: unknown;
}

const queue: TelemetryInput[] = [];
let flushTimer: number | null = null;
let installed = false;
let lastBoardSignature = '';

function serializable(value: unknown): unknown {
  try {
    return redactValue(JSON.parse(JSON.stringify(value)), 0);
  } catch {
    return { serializationError: true };
  }
}

function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, 50);

  void window.fetch('/api/observability/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    keepalive: true,
  }).catch(() => {
    // Telemetry must never break gameplay or recursively log transport errors.
  });
}

export function trackTelemetry(event: TelemetryInput) {
  queue.push({
    ...event,
    message: redactText(event.message).slice(0, 4_000),
    data: serializable(event.data),
  });
  if (queue.length >= 25) {
    flush();
    return;
  }
  if (flushTimer === null) flushTimer = window.setTimeout(flush, 750);
}

export async function withClientSpan<T>(
  name: string,
  data: Record<string, unknown>,
  operation: () => Promise<T> | T,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    trackTelemetry({
      source: 'browser',
      level: 'info',
      type: name,
      message: `${name} completed`,
      data: { ...data, durationMs: Math.round((performance.now() - startedAt) * 10) / 10 },
    });
    return result;
  } catch (error) {
    trackTelemetry({
      source: 'browser',
      level: 'error',
      type: name,
      message: `${name} failed`,
      data: {
        ...data,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

function sanitizeElement(element: Element, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (element.matches('.monaco-editor, [data-replay-block], [data-secret], [data-token], [data-api-key]')) {
    return { tag: element.tagName.toLowerCase(), blocked: true };
  }
  const attributes = Array.from(element.attributes)
    .filter((attribute) => !['value', 'data-token', 'data-secret', 'data-api-key'].includes(attribute.name.toLowerCase()))
    .slice(0, 12)
    .reduce<Record<string, string>>((result, attribute) => {
      result[attribute.name] = redactText(attribute.value).slice(0, 200);
      return result;
    }, {});

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: typeof element.className === 'string' ? element.className.slice(0, 300) : undefined,
    role: element.getAttribute('role') ?? undefined,
    ariaLabel: element.getAttribute('aria-label') ?? undefined,
    text: element.children.length === 0 ? redactText((element.textContent ?? '').trim()).slice(0, 300) : undefined,
    attributes,
    children: Array.from(element.children).slice(0, 20).map((child) => sanitizeElement(child, depth + 1)),
  };
}

export function captureDomSnapshot() {
  const snapshot = {
    path: window.location.pathname,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    activeElement: document.activeElement ? sanitizeElement(document.activeElement) : undefined,
    body: sanitizeElement(document.body),
  };

  trackTelemetry({
    source: 'browser',
    level: 'info',
    type: 'dom.snapshot',
    message: 'Sanitized DOM snapshot captured',
    data: snapshot,
  });

  return snapshot;
}

export function installTelemetry() {
  if (installed || typeof window === 'undefined') return () => undefined;
  installed = true;
  installReplayPrivacyMarkers();
  if (getReplayConsent() === 'granted') void startSessionReplay();

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalFetch = window.fetch.bind(window);

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    trackTelemetry({ source: 'browser', level: 'warn', type: 'console.warn', message: String(args[0] ?? 'Warning'), data: args.slice(1) });
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    trackTelemetry({ source: 'browser', level: 'error', type: 'console.error', message: String(args[0] ?? 'Error'), data: args.slice(1) });
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = sanitizeUrl(rawUrl);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const isTelemetryTransport = rawUrl.includes('/api/observability/events') || rawUrl.includes('/api/observability/replay');

    try {
      const response = await originalFetch(input, init);
      if (!isTelemetryTransport) {
        trackTelemetry({
          source: 'browser',
          level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
          type: 'network.request.completed',
          message: `${method} ${url} -> ${response.status}`,
          data: { method, url, status: response.status, durationMs: Math.round((performance.now() - startedAt) * 10) / 10 },
        });
      }
      return response;
    } catch (error) {
      if (!isTelemetryTransport) {
        trackTelemetry({
          source: 'browser',
          level: 'error',
          type: 'network.request.failed',
          message: `${method} ${url} failed`,
          data: { error: error instanceof Error ? error.message : String(error), durationMs: Math.round((performance.now() - startedAt) * 10) / 10 },
        });
      }
      throw error;
    }
  };

  const onError = (event: ErrorEvent) => {
    trackTelemetry({
      source: 'browser',
      level: 'error',
      type: 'window.error',
      message: event.message,
      data: { filename: sanitizeUrl(event.filename), line: event.lineno, column: event.colno, stack: event.error?.stack },
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    trackTelemetry({
      source: 'browser',
      level: 'error',
      type: 'unhandledrejection',
      message: event.reason instanceof Error ? event.reason.message : String(event.reason),
      data: event.reason instanceof Error ? { stack: event.reason.stack } : event.reason,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  const unsubscribe = useBoardStore.subscribe((state) => {
    const board = state.board;
    const signature = JSON.stringify({
      entities: board.entities.length,
      zones: board.zones.length,
      phases: board.phases.length,
      currentPhaseId: board.currentPhaseId,
      timeline: board.timelineEvents.length,
      moveLog: board.moveHistory.length,
      selectedIds: state.selectedIds,
    });
    if (signature === lastBoardSignature) return;
    lastBoardSignature = signature;

    trackTelemetry({
      source: 'game',
      level: 'info',
      type: 'board.state.changed',
      message: 'Board state changed',
      data: JSON.parse(signature),
    });
  });

  trackTelemetry({
    source: 'browser',
    level: 'info',
    type: 'session.started',
    message: 'Browser telemetry initialized',
    data: { path: window.location.pathname, userAgent: navigator.userAgent, replayConsent: getReplayConsent() },
  });

  return () => {
    unsubscribe();
    stopSessionReplay();
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    console.warn = originalWarn;
    console.error = originalError;
    window.fetch = originalFetch;
    installed = false;
  };
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactText(value).slice(0, 10_000);
  if (Array.isArray(value)) return value.slice(0, 1_000).map(item => redactValue(item, depth + 1));
  if (typeof value !== 'object') return String(value);
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = /(password|secret|token|authorization|cookie|api[-_.]?key|\.env|private[-_.]?key)/i.test(key)
      ? '[REDACTED]'
      : redactValue(entry, depth + 1);
  }
  return output;
}

function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]');
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return value.split('?', 1)[0] ?? '';
  }
}
