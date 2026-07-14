import { useState } from "react";
import { BookOpen, Check, DatabaseZap, DownloadCloud, Globe2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface WorldUpdateResult {
  ragRevision: string;
  itemCount: number;
  added: number;
  updated: number;
  removed: number;
  message: string;
}

interface NetworkRagControlProps {
  onMessage: (message: string) => void;
  onWorldUpdated: (result: WorldUpdateResult) => void;
}

type NetworkMode = "ask_first" | "ultra";
type PendingAction = { type: "art_of_war" } | { type: "huggingface" };

interface NetworkSession {
  id: string;
  mode: NetworkMode;
  expiresAt: string;
}

interface Approval {
  id: string;
  capability: string;
  targetOrigin: string;
  targetPath: string;
  reason: string;
  status: string;
}

export function NetworkRagControl({ onMessage, onWorldUpdated }: NetworkRagControlProps) {
  const [mode, setMode] = useState<NetworkMode>("ask_first");
  const [ultraConfirmed, setUltraConfirmed] = useState(false);
  const [session, setSession] = useState<NetworkSession | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [accountName, setAccountName] = useState("default");
  const [repoId, setRepoId] = useState("");
  const [revision, setRevision] = useState("main");
  const [files, setFiles] = useState("README.md");
  const [approval, setApproval] = useState<Approval | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);

  const ensureSession = async (): Promise<{ session: NetworkSession; token: string }> => {
    if (session && sessionToken && Date.parse(session.expiresAt) > Date.now() + 30_000) {
      if (session.mode !== mode) {
        const response = await fetch(`/api/network/sessions/${encodeURIComponent(session.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Network-Session-Token": sessionToken },
          body: JSON.stringify({ mode }),
        });
        const body = await response.json() as { session?: NetworkSession; error?: string };
        if (!response.ok || !body.session) throw new Error(body.error ?? "Could not update network mode.");
        setSession(body.session);
        return { session: body.session, token: sessionToken };
      }
      return { session, token: sessionToken };
    }
    const response = await fetch("/api/network/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ttlMinutes: 120 }),
    });
    const body = await response.json() as { session?: NetworkSession; token?: string; error?: string };
    if (!response.ok || !body.session || !body.token) throw new Error(body.error ?? "Could not create a network permission session.");
    setSession(body.session);
    setSessionToken(body.token);
    return { session: body.session, token: body.token };
  };

  const runImport = async (action: PendingAction) => {
    if (mode === "ultra" && !ultraConfirmed) throw new Error("Confirm Ultra before using unrestricted internet access.");
    const credentials = await ensureSession();
    const endpoint = action.type === "art_of_war" ? "/api/rag/import/art-of-war" : "/api/rag/import/huggingface";
    const payload = action.type === "art_of_war"
      ? { accountName }
      : {
          accountName,
          repoId,
          revision,
          files: files.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean),
        };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Network-Session-Id": credentials.session.id,
        "X-Network-Session-Token": credentials.token,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as { error?: string; code?: string; approval?: Approval; filePath?: string; imported?: Array<{ destination: string }>; ragRevision?: string };
    if (response.status === 409 && body.code === "network_approval_required" && body.approval) {
      setApproval(body.approval);
      setPendingAction(action);
      onMessage(`Ask First blocked the network request. Approve ${body.approval.targetOrigin}${body.approval.targetPath} for this temporary session before retrying.`);
      return;
    }
    if (!response.ok) throw new Error(body.error ?? `RAG import failed with HTTP ${response.status}.`);
    setApproval(null);
    setPendingAction(null);
    if (action.type === "art_of_war") onMessage(`The Art of War was downloaded into ${body.filePath}. RAG revision: ${body.ragRevision}.`);
    else onMessage(`Imported ${body.imported?.length ?? 0} selected Hugging Face text files into RAG. Revision: ${body.ragRevision}.`);
  };

  const execute = async (action: PendingAction) => {
    setWorking(true);
    try {
      await runImport(action);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const decideApproval = async (decision: "approved" | "denied") => {
    if (!session || !sessionToken || !approval) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/network/sessions/${encodeURIComponent(session.id)}/approvals/${encodeURIComponent(approval.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Network-Session-Token": sessionToken },
        body: JSON.stringify({ decision }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save network decision.");
      const retry = decision === "approved" ? pendingAction : null;
      setApproval(null);
      setPendingAction(null);
      onMessage(decision === "approved" ? "The exact origin, path and query are approved until this temporary session expires. Retrying the selected import." : "Network request denied.");
      if (retry) await runImport(retry);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const updateWorld = async () => {
    setWorking(true);
    try {
      const response = await fetch("/api/rag/update-world", { method: "POST" });
      const body = await response.json() as WorldUpdateResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "World update failed.");
      onWorldUpdated(body);
      onMessage(`${body.message}\nRevision: ${body.ragRevision}\nIndexed: ${body.itemCount}; updated: ${body.updated}; removed stale index entries: ${body.removed}.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold"><Globe2 className="h-3.5 w-3.5" />Network + RAG</div><span className="text-[9px] text-muted-foreground">LLM chat has no browser tool</span></div>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <div className="space-y-1"><Label className="text-[10px]">Account RAG folder</Label><Input value={accountName} onChange={event => setAccountName(event.target.value)} className="h-8 text-xs" /></div>
        <div className="space-y-1"><Label className="text-[10px]">Internet</Label><Select value={mode} onValueChange={value => { setMode(value as NetworkMode); setUltraConfirmed(false); setApproval(null); }}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ask_first">Ask First</SelectItem><SelectItem value="ultra">Ultra</SelectItem></SelectContent></Select></div>
      </div>
      {mode === "ask_first" ? <p className="rounded border p-2 text-[10px] text-muted-foreground"><ShieldAlert className="mr-1 inline h-3 w-3" />Every exact origin, path and query is blocked until you approve it. Approval remains valid only for this temporary session; redirect destinations are checked separately.</p> : <label className="flex items-start gap-2 rounded border border-amber-500/50 p-2 text-[10px]"><input type="checkbox" checked={ultraConfirmed} onChange={event => setUltraConfirmed(event.target.checked)} className="mt-0.5" /><span>Ultra: I approve all public HTTPS internet requests for this temporary session. Private networks and metadata endpoints remain blocked.</span></label>}

      {approval && <div className="rounded border border-amber-500/50 p-2 text-[10px]"><div className="font-semibold">Approval required</div><div className="break-all font-mono">{approval.targetOrigin}{approval.targetPath}</div><p className="mt-1 text-muted-foreground">{approval.reason}</p><div className="mt-2 flex gap-2"><Button size="sm" className="h-7 flex-1" disabled={working} onClick={() => void decideApproval("approved")}><Check className="mr-1 h-3 w-3" />Approve for session</Button><Button size="sm" variant="outline" className="h-7 flex-1" disabled={working} onClick={() => void decideApproval("denied")}><X className="mr-1 h-3 w-3" />Deny</Button></div></div>}

      <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" disabled={working || (mode === "ultra" && !ultraConfirmed)} onClick={() => void execute({ type: "art_of_war" })}><BookOpen className="mr-1 h-3.5 w-3.5" />Import Art of War</Button><Button size="sm" disabled={working} onClick={() => void updateWorld()}><DatabaseZap className="mr-1 h-3.5 w-3.5" />Update the world</Button></div>

      <details className="rounded border border-border p-2"><summary className="cursor-pointer text-[10px] font-medium"><DownloadCloud className="mr-1 inline h-3 w-3" />Hugging Face text → RAG</summary><div className="mt-2 space-y-2"><div className="grid grid-cols-[1fr_100px] gap-2"><Input value={repoId} onChange={event => setRepoId(event.target.value)} className="h-8 text-xs" placeholder="owner/repository" /><Input value={revision} onChange={event => setRevision(event.target.value)} className="h-8 text-xs" placeholder="main" /></div><Textarea value={files} onChange={event => setFiles(event.target.value)} className="min-h-16 font-mono text-[10px]" placeholder="README.md\ndata/train.jsonl" /><Button size="sm" variant="outline" className="w-full" disabled={working || !repoId.trim() || (mode === "ultra" && !ultraConfirmed)} onClick={() => void execute({ type: "huggingface" })}><RefreshCw className="mr-1 h-3.5 w-3.5" />Import selected non-executable text files</Button></div></details>
    </div>
  );
}
