import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bot, Bug, Camera, Download, ImagePlus, Save, Sparkles, X } from 'lucide-react';
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
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteImage, setNoteImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendAdvisorMessage();

  useEffect(() => {
    if (!open) return;
    let stream: EventSource | null = new EventSource('/api/observability/stream');
    stream.addEventListener('snapshot', ((event: MessageEvent<string>) => {
      try { setEvents((JSON.parse(event.data) as ObservabilityEvent[]).slice(-150)); } catch { /* ignore */ }
    }) as EventListener);
    stream.addEventListener('telemetry', ((event: MessageEvent<string>) => {
      try { const telemetry = JSON.parse(event.data) as ObservabilityEvent; setEvents((current) => [...current.slice(-149), telemetry]); } catch { /* ignore */ }
    }) as EventListener);
    stream.onerror = () => { stream?.close(); stream = null; };
    return () => stream?.close();
  }, [open]);

  const counts = useMemo(() => events.reduce((result, event) => { result[event.level] += 1; return result; }, { debug: 0, info: 0, warn: 0, error: 0 }), [events]);

  const handleAnalyze = async () => {
    if (!question.trim() || sendMessage.isPending) return;
    setAnalysis('');
    try {
      const response = await sendMessage.mutateAsync({ data: { role: 'neutral_analyst', message: `Act as the Developer AI. Use board state, telemetry and persistent RAG memory. Separate facts, causes and proposed changes.\n\n${question.trim()}`, board: board as never, history: [] } });
      setAnalysis(response.reply);
    } catch { setAnalysis('Developer analysis failed. Check OpenRouter and runtime telemetry.'); }
  };

  const handleSourceDebug = async () => {
    setWorking(true);
    setAnalysis('Scanning repository source code with a free coding model...');
    try {
      const response = await fetch('/api/source-debug/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request: question }) });
      const body = await response.json() as { report?: string; model?: string; files?: number; message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Source debugger failed');
      setAnalysis(`Model: ${body.model}\nFiles reviewed: ${body.files}\n\n${body.report}`);
    } catch (error) {
      setAnalysis(error instanceof Error ? error.message : String(error));
    } finally { setWorking(false); }
  };

  const handleImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setNoteImage({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || (!noteText.trim() && !noteImage)) return;
    setWorking(true);
    try {
      const response = await fetch('/api/rag/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: noteTitle, text: noteText, imageName: noteImage?.name, imageDataUrl: noteImage?.dataUrl }) });
      const body = await response.json() as { message?: string; notePath?: string };
      if (!response.ok) throw new Error(body.message ?? 'Could not save RAG note');
      setAnalysis(`Saved to RAG: ${body.notePath}\nThe note was immediately synchronized into persistent memory.`);
      setNoteTitle(''); setNoteText(''); setNoteImage(null);
    } catch (error) { setAnalysis(error instanceof Error ? error.message : String(error)); }
    finally { setWorking(false); }
  };

  const handleExportPackage = () => {
    const payload = { packageName: `developer-review-${new Date().toISOString()}`, question, analysis, telemetry: events.slice(-150), boardSummary: { entities: board.entities.length, zones: board.zones.length, phases: board.phases.length } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'developer-review.json'; link.click(); URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-12 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><div className="text-sm font-semibold">Developer AI</div><div className="text-[10px] text-muted-foreground">Source debugger, RAG notes and live observability</div></div></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        <Badge variant="outline">Events {events.length}</Badge><Badge variant="outline">Errors {counts.error}</Badge><Badge variant="outline">Warnings {counts.warn}</Badge>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => captureDomSnapshot()}><Camera className="mr-1 h-3 w-3" />DOM</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleExportPackage}><Download className="mr-1 h-3 w-3" />Export</Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto_minmax(0,1fr)]">
        <ScrollArea className="border-b border-border p-3"><div className="space-y-2">{[...events].reverse().map((event) => <div key={event.id} className="rounded-md border border-border bg-muted/30 p-2 text-[10px]"><div className="flex justify-between"><span className="font-medium"><Activity className="mr-1 inline h-3 w-3" />{event.source} · {event.type}</span><span>{event.level}</span></div><div className="mt-1">{event.message}</div></div>)}</div></ScrollArea>
        <div className="space-y-2 border-b border-border p-3"><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-16 text-xs" /><div className="grid grid-cols-2 gap-2"><Button size="sm" onClick={handleAnalyze} disabled={working || sendMessage.isPending}><Sparkles className="mr-1 h-3.5 w-3.5" />Analyze runtime</Button><Button size="sm" variant="secondary" onClick={handleSourceDebug} disabled={working}><Bug className="mr-1 h-3.5 w-3.5" />Debug all source</Button></div></div>
        <div className="space-y-2 border-b border-border p-3"><input className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" placeholder="RAG note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} /><Textarea className="min-h-16 text-xs" placeholder="Text note, world information, design idea or image description" value={noteText} onChange={(event) => setNoteText(event.target.value)} /><div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 h-3.5 w-3.5" />{noteImage?.name ?? 'Add image'}</Button><Button size="sm" className="flex-1" onClick={handleSaveNote} disabled={working || !noteTitle.trim()}><Save className="mr-1 h-3.5 w-3.5" />Save to RAG</Button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImage(file); }} /></div></div>
        <ScrollArea className="p-3"><div className="whitespace-pre-wrap text-xs leading-relaxed">{analysis || 'Run runtime analysis, debug the full source code, or save text and images into RAG.'}</div></ScrollArea>
      </div>
    </div>
  );
}
