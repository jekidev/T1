import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AgentRunSchema,
  type AgentRun,
  type CodingAgentId,
} from "@workspace/coding-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  TestTube2,
  XCircle,
} from "lucide-react";

interface Capabilities {
  enabled: boolean;
  adapters: Array<{ id: CodingAgentId; configured: boolean; executionBoundary: string }>;
  baseCommitConfigured: boolean;
  directDefaultBranchWrite: false;
  localShellExecution: false;
  humanReviewRequired: true;
  maximumConcurrentRuns: number;
}

const ACTIVE_STATUSES = new Set<AgentRun["status"]>(["created", "analyzing", "planned", "executing", "validating"]);

export default function CodingAgentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [adapter, setAdapter] = useState<CodingAgentId>("openhands");
  const [objective, setObjective] = useState("Improve a documented issue without changing protected paths.");
  const [allowedPaths, setAllowedPaths] = useState("artifacts/command-sim/src/\nlib/strategy-sim/src/");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => runs.find(run => run.id === selectedId) ?? runs[0] ?? null, [runs, selectedId]);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (token.trim().length < 24) throw new Error("Enter the separate coding-agent admin token first.");
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        "X-Coding-Agent-Admin-Token": token,
        ...init.headers,
      },
    });
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Request failed with HTTP ${response.status}.`);
    return body;
  }, [token]);

  const refresh = useCallback(async () => {
    if (token.trim().length < 24) return;
    const [capabilityBody, runBody] = await Promise.all([
      request<Capabilities>("/api/coding-agent/capabilities"),
      request<{ runs: unknown[] }>("/api/coding-agent/runs?limit=100"),
    ]);
    const parsedRuns = runBody.runs.map(value => AgentRunSchema.parse(value));
    setCapabilities(capabilityBody);
    setRuns(parsedRuns);
    setSelectedId(current => current && parsedRuns.some(run => run.id === current) ? current : parsedRuns[0]?.id ?? null);
  }, [request, token]);

  useEffect(() => {
    if (token.trim().length < 24) return;
    void refresh().catch(error => toast({ title: "Coding-agent connection failed", description: String(error), variant: "destructive" }));
  }, [refresh, toast, token]);

  useEffect(() => {
    if (!runs.some(run => ACTIVE_STATUSES.has(run.status)) || token.trim().length < 24) return;
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 2_000);
    return () => window.clearInterval(interval);
  }, [refresh, runs, token]);

  const createRun = async () => {
    setBusy(true);
    try {
      const paths = allowedPaths.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
      const body = await request<{ run: unknown }>("/api/coding-agent/runs", {
        method: "POST",
        body: JSON.stringify({
          objective,
          signal: "explicit_user_request",
          requestedAdapter: adapter,
          baseBranch: "main",
          allowedPaths: paths,
          labels: [],
        }),
      });
      const run = AgentRunSchema.parse(body.run);
      setRuns(current => [run, ...current.filter(item => item.id !== run.id)]);
      setSelectedId(run.id);
      toast({ title: run.status === "rejected" ? "Task rejected by policy" : "Isolated agent run created", description: run.branchName });
    } catch (error) {
      toast({ title: "Cannot create run", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const execute = async (run: AgentRun) => {
    setBusy(true);
    try {
      await request(`/api/coding-agent/runs/${encodeURIComponent(run.id)}/execute`, { method: "POST" });
      await refresh();
    } catch (error) {
      toast({ title: "Cannot execute run", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const stop = async (run: AgentRun) => {
    setBusy(true);
    try {
      await request(`/api/coding-agent/runs/${encodeURIComponent(run.id)}/stop`, { method: "POST" });
      await refresh();
    } catch (error) {
      toast({ title: "Cannot stop run", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const rebuildMap = async () => {
    setBusy(true);
    try {
      const body = await request<{ repositoryMap: { files: unknown[]; modules: unknown[]; baseCommit: string } }>("/api/coding-agent/repository-map", {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      toast({ title: "Repository map rebuilt", description: `${body.repositoryMap.files.length} files · ${body.repositoryMap.modules.length} modules · ${body.repositoryMap.baseCommit.slice(0, 12)}` });
    } catch (error) {
      toast({ title: "Repository map failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button>
            <div><h1 className="text-xl font-semibold">Controlled Coding Agent</h1><p className="text-xs text-muted-foreground">OpenHands/Aider → isolated branch → patch → tests → PR review</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy || token.length < 24} onClick={() => void rebuildMap()}><GitBranch className="mr-1 h-3.5 w-3.5" />Rebuild map</Button>
            <Button variant="outline" size="sm" disabled={busy || token.length < 24} onClick={() => void refresh()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1"><Label>Separate admin token</Label><Input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" data-replay-block placeholder="Not stored in localStorage or build variables" /></div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Readiness label="Exact base commit" ready={capabilities?.baseCommitConfigured ?? false} />
              <Readiness label="External adapter" ready={capabilities?.enabled ?? false} />
              <Readiness label="No local shell" ready={capabilities?.localShellExecution === false} />
              <Readiness label="Human review" ready={capabilities?.humanReviewRequired === true} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Create isolated task</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label>Adapter</Label><Select value={adapter} onValueChange={value => setAdapter(value as CodingAgentId)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openhands">OpenHands · multi-step</SelectItem><SelectItem value="aider">Aider · focused patch</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Measurable objective</Label><Textarea value={objective} onChange={event => setObjective(event.target.value)} className="min-h-28" /></div>
                <div className="space-y-1"><Label>Allowed paths, one per line</Label><Textarea value={allowedPaths} onChange={event => setAllowedPaths(event.target.value)} className="min-h-24 font-mono text-xs" /></div>
                <div className="rounded border p-2 text-[10px] text-muted-foreground"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Protected paths, policy code, secrets, default-branch writes and untested patches are rejected.</div>
                <Button className="w-full" disabled={busy || token.length < 24 || !objective.trim()} onClick={() => void createRun()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}Create run</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Runs</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {runs.length === 0 ? <p className="text-xs text-muted-foreground">No authenticated runs loaded.</p> : runs.map(run => <button type="button" key={run.id} onClick={() => setSelectedId(run.id)} className={`w-full rounded border p-2 text-left text-[10px] ${selected?.id === run.id ? "border-primary bg-primary/5" : ""}`}><div className="flex justify-between gap-2"><strong className="truncate">{run.task.objective}</strong><Badge variant={run.status === "rejected" || run.status === "failed" ? "destructive" : "outline"} className="text-[8px]">{run.status}</Badge></div><div className="mt-1 truncate text-muted-foreground">{run.adapterId} · {run.branchName}</div></button>)}
              </CardContent>
            </Card>
          </div>

          <RunInspector run={selected} busy={busy} onExecute={execute} onStop={stop} />
        </div>
      </div>
    </div>
  );
}

function RunInspector({ run, busy, onExecute, onStop }: { run: AgentRun | null; busy: boolean; onExecute: (run: AgentRun) => Promise<void>; onStop: (run: AgentRun) => Promise<void> }) {
  if (!run) return <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Create or select a run.</CardContent></Card>;
  return (
    <Card>
      <CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle className="text-sm">{run.task.objective}</CardTitle><p className="mt-1 font-mono text-[9px] text-muted-foreground">{run.id} · {run.baseCommit} · {run.branchName}</p></div><div className="flex gap-2">{run.status === "created" && <Button size="sm" disabled={busy} onClick={() => void onExecute(run)}><Play className="mr-1 h-3.5 w-3.5" />Execute</Button>}{ACTIVE_STATUSES.has(run.status) && run.status !== "created" && <Button size="sm" variant="destructive" disabled={busy} onClick={() => void onStop(run)}><Square className="mr-1 h-3.5 w-3.5" />Stop</Button>}</div></div></CardHeader>
      <CardContent className="space-y-4">
        <Section title="Policy"><div className="grid gap-2 text-xs md:grid-cols-4"><Value label="Accepted" value={String(run.policyDecision?.accepted ?? false)} /><Value label="Risk" value={run.policyDecision?.risk ?? "unknown"} /><Value label="Human review" value={String(run.policyDecision?.requiresHumanReview ?? true)} /><Value label="External reviewer" value={String(run.policyDecision?.requiresExternalReviewer ?? false)} /></div>{run.policyDecision?.reasons.map(reason => <p key={reason} className="mt-1 text-[10px] text-muted-foreground">{reason}</p>)}</Section>
        {run.plan && <Section title="Plan"><p className="text-xs">{run.plan.reason}</p><div className="mt-2 grid gap-2 text-[10px] md:grid-cols-2"><List title="Expected files" values={run.plan.expectedFiles} /><List title="Validation" values={run.plan.validationSteps} /><List title="Risks" values={run.plan.risks} /><List title="Rollback" values={[run.plan.rollbackPlan]} /></div></Section>}
        {run.patch && <Section title="Patch"><div className="mb-2 flex flex-wrap gap-2 text-[10px]"><Badge variant="outline">{run.patch.changedFiles.length} files</Badge><Badge variant="outline">+{run.patch.additions}</Badge><Badge variant="outline">-{run.patch.deletions}</Badge></div><pre className="max-h-96 overflow-auto rounded border bg-muted/20 p-3 text-[9px]" data-replay-block>{run.patch.diff}</pre></Section>}
        <Section title="Tests and commands"><div className="space-y-1">{run.tests.length === 0 && <p className="text-xs text-muted-foreground">No verified test result yet.</p>}{run.tests.map(test => <div key={`${test.name}-${test.command}`} className="flex items-start justify-between gap-3 rounded border p-2 text-[10px]"><div><strong>{test.name}</strong><div className="font-mono text-muted-foreground">{test.command}</div><p>{test.summary}</p></div>{test.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}</div>)}</div></Section>
        <Section title="Audit"><div className="max-h-72 space-y-1 overflow-auto">{run.auditEvents.map((event, index) => <div key={`${event.at}-${event.type}-${index}`} className="grid grid-cols-[150px_1fr] gap-2 border-b py-1 text-[9px]"><span className="font-mono text-muted-foreground">{event.at}</span><span>{event.type}</span></div>)}</div></Section>
        {run.pullRequestUrl && <Button asChild variant="outline"><a href={run.pullRequestUrl} target="_blank" rel="noreferrer"><GitBranch className="mr-2 h-4 w-4" />Open review-only pull request</a></Button>}
        {run.error && <div className="rounded border border-destructive/50 p-3 text-xs text-destructive">{run.error.code}: {run.error.message}</div>}
        <div className="rounded border p-2 text-[10px] text-muted-foreground"><TestTube2 className="mr-1 inline h-3.5 w-3.5" />The application has no merge action. Approval and merge remain in GitHub after CI and human review.</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-2 text-xs font-semibold">{title}</h3>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div className="rounded border p-2"><div className="text-[9px] text-muted-foreground">{label}</div><div className="font-mono text-[10px]">{value}</div></div>; }
function List({ title, values }: { title: string; values: string[] }) { return <div className="rounded border p-2"><strong>{title}</strong>{values.length === 0 ? <p className="text-muted-foreground">None</p> : values.map(value => <p key={value} className="mt-1 break-all text-muted-foreground">{value}</p>)}</div>; }
function Readiness({ label, ready }: { label: string; ready: boolean }) { return <span className="flex items-center gap-1 rounded border px-2 py-1">{ready ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}{label}</span>; }
