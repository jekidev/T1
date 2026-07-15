import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Brain, Code2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LLM_MODE_META, type LlmUserMode, useLlmMode } from "@/lib/llm-mode";

interface HeadsUpNotification {
  id: string;
  kind: "wisdom" | "behavior" | "system";
  title: string;
  body: string;
  mode: LlmUserMode;
  createdAt: string;
  sourcePath?: string;
  sourceTitle?: string;
  model?: string | null;
  scriptPath?: string;
}

interface HeadsUpDockProps {
  board: Record<string, unknown>;
  behavior?: string | null;
}

function browserNotify(notification: HeadsUpNotification) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(notification.title, {
    body: notification.body.slice(0, 260),
    tag: notification.kind === "wisdom" ? "t1-hourly-wisdom" : `t1-${notification.id}`,
  });
}

function boardSignature(board: Record<string, unknown>): string {
  const simulation = board.simulation && typeof board.simulation === "object" ? board.simulation as Record<string, unknown> : {};
  const moveLog = Array.isArray(board.moveLog) ? board.moveLog : [];
  return JSON.stringify({
    turn: simulation.turn,
    currentPhaseId: board.currentPhaseId,
    entities: Array.isArray(board.entities) ? board.entities.length : 0,
    zones: Array.isArray(board.zones) ? board.zones.length : 0,
    latestMove: moveLog.at(-1),
  });
}

export function HeadsUpDock({ board, behavior }: HeadsUpDockProps) {
  const [mode, setMode] = useLlmMode();
  const [latest, setLatest] = useState<HeadsUpNotification | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [working, setWorking] = useState(false);
  const lastBehavior = useRef("");
  const initialBoardSignature = useRef<string | null>(null);
  const latestBoardSignature = useMemo(() => boardSignature(board), [board]);

  useEffect(() => {
    void fetch("/api/llm/headsup/current")
      .then((response) => response.json())
      .then((body: { notification?: HeadsUpNotification | null }) => { if (body.notification) setLatest(body.notification); })
      .catch(() => undefined);

    const stream = new EventSource("/api/llm/headsup/stream");
    stream.addEventListener("heads-up", ((event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as HeadsUpNotification;
        setLatest(notification);
        browserNotify(notification);
      } catch {
        // Ignore malformed stream events.
      }
    }) as EventListener);
    return () => stream.close();
  }, []);

  useEffect(() => {
    if (mode === "light" || !behavior || behavior === lastBehavior.current) return;
    lastBehavior.current = behavior;
    void fetch("/api/llm/copilot/commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, board, behavior }),
    }).catch(() => undefined);
  }, [behavior, board, mode]);

  useEffect(() => {
    if (mode !== "uber") {
      initialBoardSignature.current = latestBoardSignature;
      return;
    }
    if (initialBoardSignature.current === null) {
      initialBoardSignature.current = latestBoardSignature;
      return;
    }
    if (initialBoardSignature.current === latestBoardSignature) return;
    initialBoardSignature.current = latestBoardSignature;
    const timer = window.setTimeout(() => {
      void fetch("/api/llm/copilot/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          board,
          behavior: `Realtime board state changed: ${latestBoardSignature}`,
        }),
      }).catch(() => undefined);
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [board, latestBoardSignature, mode]);

  const refresh = async () => {
    setWorking(true);
    try {
      const response = await fetch("/api/llm/headsup/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await response.json() as { notification?: HeadsUpNotification };
      if (body.notification) setLatest(body.notification);
    } finally {
      setWorking(false);
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
  };

  if (collapsed) {
    return <Button className="fixed bottom-3 right-3 z-40 h-10 shadow-xl" onClick={() => setCollapsed(false)}><BellRing className="mr-2 h-4 w-4" />Heads up · {LLM_MODE_META[mode].label}</Button>;
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 w-[min(420px,calc(100vw-24px))] rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><div><div className="text-xs font-semibold">LLM Heads Up</div><div className="text-[9px] text-muted-foreground">{LLM_MODE_META[mode].short}</div></div></div>
        <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void enableNotifications()} title="Enable browser notifications"><Bell className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)}><Minimize2 className="h-3.5 w-3.5" /></Button></div>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2">
        {(Object.keys(LLM_MODE_META) as LlmUserMode[]).map((value) => <Button key={value} size="sm" variant={mode === value ? "default" : "outline"} className="h-8 text-[10px]" onClick={() => setMode(value)}>{LLM_MODE_META[value].label}</Button>)}
      </div>
      <div className="border-t border-border p-3">
        {latest ? <>
          <div className="mb-2 flex items-center justify-between gap-2"><div className="text-xs font-semibold">{latest.title}</div><Badge variant="outline" className="text-[9px]">{latest.kind}</Badge></div>
          <div className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">{latest.body}</div>
          <div className="mt-2 space-y-1 text-[9px] text-muted-foreground">{latest.sourceTitle && <div>Source: {latest.sourceTitle}</div>}{latest.model && <div>Model: {latest.model}</div>}{latest.scriptPath && <div className="flex items-start gap-1"><Code2 className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-all">Review-only PR proposal: {latest.scriptPath}</span></div>}</div>
        </> : <div className="text-[11px] text-muted-foreground">Waiting for the first hourly wisdom item from rag/wisdom/common/everyday tips.</div>}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2"><span className="text-[9px] text-muted-foreground">PDF · DOCX · DOC · TXT · TEXT · MD</span><Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={working} onClick={() => void refresh()}><RefreshCw className={`mr-1 h-3 w-3 ${working ? "animate-spin" : ""}`} />Now</Button></div>
    </div>
  );
}
