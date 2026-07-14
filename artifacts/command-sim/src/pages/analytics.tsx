import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Activity, ArrowLeft, Bot, Gauge, Network, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ObservabilityEvent {
  id: string;
  timestamp: string;
  source: 'browser' | 'server' | 'game' | 'system';
  level: 'debug' | 'info' | 'warn' | 'error';
  type: string;
  message: string;
  data?: unknown;
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div><div className="text-2xl font-semibold tabular-nums">{value}</div></div>;
}

export default function AnalyticsPage() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);

  useEffect(() => {
    const stream = new EventSource('/api/observability/stream');
    stream.addEventListener('snapshot', event => {
      try { setEvents((JSON.parse((event as MessageEvent<string>).data) as ObservabilityEvent[]).slice(-300)); } catch { /* ignore */ }
    });
    stream.addEventListener('telemetry', event => {
      try { const row = JSON.parse((event as MessageEvent<string>).data) as ObservabilityEvent; setEvents(current => [...current.slice(-299), row]); } catch { /* ignore */ }
    });
    return () => stream.close();
  }, []);

  const metrics = useMemo(() => {
    const errors = events.filter(event => event.level === 'error').length;
    const warnings = events.filter(event => event.level === 'warn').length;
    const llm = events.filter(event => event.type.startsWith('llm.'));
    const requests = events.filter(event => event.type.includes('request'));
    const successfulLlm = llm.filter(event => event.type === 'llm.route.success').length;
    const latencies = events.flatMap(event => {
      if (!event.data || typeof event.data !== 'object' || !('durationMs' in event.data)) return [];
      const value = Number((event.data as { durationMs?: unknown }).durationMs);
      return Number.isFinite(value) ? [value] : [];
    });
    const averageLatency = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0;
    return { errors, warnings, requests: requests.length, successfulLlm, averageLatency };
  }, [events]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [events]);

  const maxCount = Math.max(1, ...byType.map(([, count]) => count));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold">Realtime Analytics</h1><p className="text-xs text-muted-foreground">Game, browser, network, server and LLM telemetry</p></div><Button variant="outline" onClick={() => history.length > 1 ? history.back() : setLocation('/')}><ArrowLeft className="mr-2 h-4 w-4" />Tilbage</Button></div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Events" value={events.length} icon={<Activity className="h-4 w-4" />} />
          <MetricCard label="Requests" value={metrics.requests} icon={<Network className="h-4 w-4" />} />
          <MetricCard label="Avg. latency" value={`${metrics.averageLatency} ms`} icon={<Gauge className="h-4 w-4" />} />
          <MetricCard label="LLM success" value={metrics.successfulLlm} icon={<Bot className="h-4 w-4" />} />
          <MetricCard label="Errors / warnings" value={`${metrics.errors} / ${metrics.warnings}`} icon={<TriangleAlert className="h-4 w-4" />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-lg border border-border bg-card p-4"><h2 className="mb-4 text-sm font-semibold">Event distribution</h2><div className="space-y-3">{byType.map(([type, count]) => <div key={type}><div className="mb-1 flex justify-between text-[11px]"><span className="truncate pr-3">{type}</span><span>{count}</span></div><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full origin-left animate-pulse rounded bg-primary transition-all duration-700" style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }} /></div></div>)}</div></section>
          <section className="rounded-lg border border-border bg-card p-4"><h2 className="mb-4 text-sm font-semibold">Live timeline</h2><div className="max-h-[520px] space-y-2 overflow-auto">{[...events].reverse().slice(0, 80).map(event => <div key={event.id} className="rounded border border-border bg-background/60 p-2 text-[10px]"><div className="flex justify-between gap-2"><span className="font-medium">{event.source} · {event.type}</span><span className={event.level === 'error' ? 'text-destructive' : event.level === 'warn' ? 'text-amber-500' : 'text-muted-foreground'}>{event.level}</span></div><div className="mt-1 break-words">{event.message}</div><div className="mt-1 text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</div></div>)}</div></section>
        </div>
      </div>
    </div>
  );
}
