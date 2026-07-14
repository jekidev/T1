import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Camera, Download, Sparkles, X } from 'lucide-react';
import { useSendAdvisorMessage } from '@workspace/api-client-react';
import { useBoardStore } from '@/lib/game';
import { captureDomSnapshot, trackTelemetry } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ObservabilityEvent {
  id: string;
  timestamp: string;
  source: 'browser' | 'server' | 'game' | 'system';
  level: 'debug' | 'info' | 'warn' | 'error';
  type: string;
  message: string;
  data?: unknown;
}

interface DeveloperAiPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DeveloperAiPanel({ open, onClose }: DeveloperAiPanelProps) {
  const board = useBoardStore((state) => state.board);
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [question, setQuestion] = useState('Analyze the latest runtime events, identify the most important bug or UX issue, and propose a safe implementation plan.');
  const sendMessage = useSendAdvisorMessage();

  useEffect(() => {
    if (!open) return;

    let stream: EventSource | null = new EventSource('/api/observability/stream');
    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const snapshot = JSON.parse(event.data) as ObservabilityEvent[];
        setEvents(snapshot.slice(-150));
      } catch {
        // Ignore malformed telemetry payloads.
      }
    };
    const onTelemetry = (event: MessageEvent<string>) => {
      try {
        const telemetry = JSON.parse(event.data) as ObservabilityEvent;
        setEvents((current) => [...current.slice(-149), telemetry]);
      } catch {
        // Ignore malformed telemetry payloads.
      }
    };

    stream.addEventListener('snapshot', onSnapshot as EventListener);
    stream.addEventListener('telemetry', onTelemetry as EventListener);
    stream.onerror = () => {
      stream?.close();
      stream = null;
    };

    return () => stream?.close();
  }, [open]);

  const counts = useMemo(() => {
    return events.reduce(
      (result, event) => {
        result[event.level] += 1;
        return result;
      },
      { debug: 0, info: 0, warn: 0, error: 0 },
    );
  }, [events]);

  const handleCaptureDom = () => {
    const snapshot = captureDomSnapshot();
    trackTelemetry({
      source: 'browser',
      level: 'info',
      type: 'developer.capture.requested',
      message: 'Developer requested a DOM snapshot',
      data: { path: snapshot.path },
    });
  };

  const handleAnalyze = async () => {
    if (!question.trim() || sendMessage.isPending) return;
    setAnalysis('');

    try {
      const response = await sendMessage.mutateAsync({
        data: {
          role: 'neutral_analyst',
          message: [
            'Act as the Developer AI for this application.',
            'Use the supplied board state and the latest runtime telemetry already attached by the server.',
            'Separate observed facts, likely causes, and proposed changes.',
            'Do not claim that code has been changed. Return a concise implementation plan with target feature folders and validation steps.',
            '',
            question.trim(),
          ].join('\n'),
          board: board as never,
          history: [],
        },
      });
      setAnalysis(response.reply);
    } catch {
      setAnalysis('Developer analysis failed. Inspect the latest error events and verify the OpenRouter connection.');
    }
  };

  const handleExportPackage = () => {
    const packageName = `developer-review-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const payload = {
      packageName,
      version: '0.1.0',
      submittedAt: new Date().toISOString(),
      source: 'in-app Developer AI panel',
      status: 'review',
      trustedSource: true,
      executeAutomatically: false,
      targetFeatures: ['ui-and-experience', 'ai-advisor', 'game-core'],
      question,
      analysis,
      telemetry: events.slice(-150),
      boardSummary: {
        entities: board.entities.length,
        zones: board.zones.length,
        phases: board.phases.length,
        currentPhaseId: board.currentPhaseId,
        timeline: board.timeline.length,
        moveLog: board.moveLog.length,
      },
      instructions: 'Place this JSON in features/integrate/review and validate all proposed changes before implementation.',
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packageName}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-12 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Developer AI</div>
            <div className="text-[10px] text-muted-foreground">Live state, browser, network and server observability</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        <Badge variant="outline">Events {events.length}</Badge>
        <Badge variant="outline">Errors {counts.error}</Badge>
        <Badge variant="outline">Warnings {counts.warn}</Badge>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleCaptureDom}>
          <Camera className="mr-1 h-3 w-3" /> Capture DOM
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleExportPackage}>
          <Download className="mr-1 h-3 w-3" /> Export review package
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <ScrollArea className="border-b border-border p-3">
          <div className="space-y-2">
            {events.length === 0 && <div className="text-xs text-muted-foreground">Waiting for telemetry...</div>}
            {[...events].reverse().map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-muted/30 p-2 text-[10px]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Activity className="h-3 w-3" />
                    {event.source} · {event.type}
                  </div>
                  <span className={event.level === 'error' ? 'text-destructive' : event.level === 'warn' ? 'text-amber-500' : 'text-muted-foreground'}>
                    {event.level}
                  </span>
                </div>
                <div className="break-words text-foreground/90">{event.message}</div>
                <div className="mt-1 text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2 border-b border-border p-3">
          <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-20 text-xs" />
          <Button className="w-full" size="sm" onClick={handleAnalyze} disabled={sendMessage.isPending || !question.trim()}>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            {sendMessage.isPending ? 'Analyzing runtime...' : 'Analyze with AI'}
          </Button>
        </div>

        <ScrollArea className="p-3">
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {analysis || 'The AI analysis will appear here. It can inspect the current board and recent telemetry, but it cannot apply code changes without a separate reviewed integration step.'}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
