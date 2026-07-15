import { useBoardStore } from '@/lib/game';

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
    return JSON.parse(JSON.stringify(value));
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
  queue.push({ ...event, data: serializable(event.data) });
  if (queue.length >= 25) {
    flush();
    return;
  }
  if (flushTimer === null) flushTimer = window.setTimeout(flush, 750);
}

function sanitizeElement(element: Element, depth = 0): unknown {
  if (depth > 4) return undefined;
  const attributes = Array.from(element.attributes)
    .filter((attribute) => !['value', 'data-token', 'data-secret'].includes(attribute.name.toLowerCase()))
    .slice(0, 12)
    .reduce<Record<string, string>>((result, attribute) => {
      result[attribute.name] = attribute.value.slice(0, 200);
      return result;
    }, {});

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: typeof element.className === 'string' ? element.className.slice(0, 300) : undefined,
    role: element.getAttribute('role') ?? undefined,
    ariaLabel: element.getAttribute('aria-label') ?? undefined,
    text: element.children.length === 0 ? (element.textContent ?? '').trim().slice(0, 300) : undefined,
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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const isTelemetryTransport = url.includes('/api/observability/events');

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
      data: { filename: event.filename, line: event.lineno, column: event.colno, stack: event.error?.stack },
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
    data: { path: window.location.pathname, userAgent: navigator.userAgent },
  });

  return () => {
    unsubscribe();
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    console.warn = originalWarn;
    console.error = originalError;
    window.fetch = originalFetch;
    installed = false;
  };
}
