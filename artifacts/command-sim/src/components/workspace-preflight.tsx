import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, CircleAlert, Github, KeyRound, Loader2, LockKeyhole, MapPinned, Network, RefreshCw } from "lucide-react";

export interface WorkspaceStatus {
  sessionId: string;
  expiresAt: string;
  github: { connected: boolean; tested: boolean; user?: { login: string; name?: string; avatarUrl?: string } };
  google: { connected: boolean; gmailTested: boolean; driveTested: boolean; user?: { email: string; name?: string; picture?: string } };
  googleMaps: { configured: boolean; tested: boolean };
  openRouter: { configured: boolean; tested: boolean };
  proxy: { tested: boolean; detail?: string };
  testedAt?: string;
  ready: boolean;
}

export function WorkspacePreflight({ onReady, compact = false }: { onReady?: (status: WorkspaceStatus) => void; compact?: boolean }) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [mapsKey, setMapsKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/workspace/auth/status", { credentials: "include" });
    const body = await response.json() as WorkspaceStatus & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Workspace status failed.");
    setStatus(body);
    if (body.ready) onReady?.(body);
    return body;
  }, [onReady]);

  useEffect(() => { void refresh().catch(cause => setError(cause instanceof Error ? cause.message : String(cause))); }, [refresh]);

  const saveKeys = async () => {
    if (!openRouterKey.trim() && !mapsKey.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/auth/credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(openRouterKey.trim() ? { openRouterApiKey: openRouterKey.trim() } : {}),
          ...(mapsKey.trim() ? { googleMapsApiKey: mapsKey.trim() } : {}),
        }),
      });
      const body = await response.json() as WorkspaceStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Credential registration failed.");
      setOpenRouterKey("");
      setMapsKey("");
      setStatus(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const runTests = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/auth/test", { method: "POST", credentials: "include" });
      const body = await response.json() as WorkspaceStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Preflight failed.");
      setStatus(body);
      if (body.ready) onReady?.(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const checks = useMemo(() => status ? [
    ["GitHub", status.github.connected && status.github.tested, status.github.user?.login ?? "OAuth required"],
    ["Gmail", status.google.connected && status.google.gmailTested, status.google.user?.email ?? "Google OAuth required"],
    ["Google Drive", status.google.connected && status.google.driveTested, status.google.user?.email ?? "Google OAuth required"],
    ["Google Maps API", status.googleMaps.configured && status.googleMaps.tested, status.googleMaps.configured ? "Key registered" : "API key required"],
    ["OpenRouter", status.openRouter.configured && status.openRouter.tested, status.openRouter.configured ? "Key registered" : "API key required"],
    ["Mullvad proxy", status.proxy.tested, status.proxy.detail ?? "Mullvad exit test required"],
  ] as const : [], [status]);

  return (
    <Card className={compact ? "w-full" : "mx-auto w-full max-w-4xl border-primary/30 bg-card/95 shadow-2xl shadow-primary/10"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Workspace Preflight</CardTitle><CardDescription>All required services must be connected and tested before the board opens. Secrets remain in the temporary server session.</CardDescription></div>
          {status?.ready ? <Badge className="bg-emerald-600">READY</Badge> : <Badge variant="outline">LOCKED</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {checks.map(([label, ok, detail]) => <div key={label} className={`rounded-lg border p-3 shadow-inner ${ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}><div className="flex items-center justify-between gap-2 text-sm font-medium"><span>{label}</span>{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}</div><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{detail}</p></div>)}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border bg-background/60 p-3 shadow-inner">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Github className="h-4 w-4" />OAuth connections</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={status?.github.connected ? "secondary" : "default"} onClick={() => { window.location.href = "/api/workspace/auth/github/start"; }}><Github className="mr-2 h-4 w-4" />{status?.github.connected ? "Reconnect GitHub" : "Connect GitHub"}</Button>
              <Button variant={status?.google.connected ? "secondary" : "default"} onClick={() => { window.location.href = "/api/workspace/auth/google/start"; }}><KeyRound className="mr-2 h-4 w-4" />{status?.google.connected ? "Reconnect Google" : "Connect Google"}</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-3 shadow-inner">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" />API credentials</div>
            <div className="grid gap-2 md:grid-cols-2">
              <div><Label className="text-[10px]">OpenRouter key</Label><Input type="password" autoComplete="off" value={openRouterKey} onChange={event => setOpenRouterKey(event.target.value)} placeholder={status?.openRouter.configured ? "Replace registered key" : "sk-or-…"} /></div>
              <div><Label className="text-[10px]">Google Maps API key</Label><Input type="password" autoComplete="off" value={mapsKey} onChange={event => setMapsKey(event.target.value)} placeholder={status?.googleMaps.configured ? "Replace registered key" : "AIza…"} /></div>
            </div>
            <Button className="mt-2 w-full" variant="outline" disabled={busy || (!openRouterKey.trim() && !mapsKey.trim())} onClick={() => void saveKeys()}><KeyRound className="mr-2 h-4 w-4" />Register keys in session</Button>
          </div>
        </div>

        <div className="rounded-lg border bg-background/60 p-3 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium"><Network className="h-4 w-4" />Mandatory connectivity test</div><p className="text-[10px] text-muted-foreground">Tests GitHub, Gmail, Drive, Maps, OpenRouter and whether the server egress is a Mullvad exit. Mullvad multihop itself cannot be proven from the exit-IP endpoint.</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button disabled={busy} onClick={() => void runTests()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPinned className="mr-2 h-4 w-4" />}Run all tests</Button></div></div>
        </div>

        {error && <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
}

export function PreflightGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workspace/auth/status", { credentials: "include" })
      .then(async response => response.ok ? response.json() as Promise<WorkspaceStatus> : Promise.reject(new Error("Preflight status failed")))
      .then(status => setReady(status.ready))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (ready) return <>{children}</>;
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_40%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.25))] p-4 md:p-10"><WorkspacePreflight onReady={() => setReady(true)} /></div>;
}
