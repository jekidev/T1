import { useBoardStore } from '@/lib/game';

type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';
type TelemetrySource = 'browser' | 'game';

interface TelemetryInput {
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

  void fetch('/api/observability/events', {
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

export function installTelemetry() {
  if (installed || typeof window === 'undefined') return () => undefined;
  installed = true;

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    trackTelemetry({ source: 'browser', level: 'warn', type: 'console.warn', message: String(args[0] ?? 'Warning'), data: args.slice(1) });
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    trackTelemetry({ source: 'browser', level: 'error', type: 'console.error', message: String(args[0] ?? 'Error'), data: args.slice(1) });
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
      timeline: board.timeline.length,
      moveLog: board.moveLog.length,
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
    installed = false;
  };
}
