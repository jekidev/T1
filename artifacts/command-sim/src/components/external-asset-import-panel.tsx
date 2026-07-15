import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Boxes, Check, Figma, Loader2, RefreshCw } from "lucide-react";

export interface ExternalAssetRecord {
  id: string;
  provider: "figma" | "huggingface";
  sourceAssetId: string;
  name: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  sourceReference: string;
  licenseStatus: "unverified" | "restricted";
  createdAt: string;
}

interface NetworkSession {
  id: string;
  token: string;
  expiresAt: string;
}

interface PendingApproval {
  id: string;
  capability: string;
  targetOrigin: string;
  targetPath: string;
  reason: string;
}

interface Capabilities {
  figma: { configured: boolean };
  huggingFace: { configured: boolean };
  vercel: { detected: boolean; configured: boolean; persistenceMode: string };
}

export function ExternalAssetImportPanel({ onSelect }: { onSelect: (asset: ExternalAssetRecord) => void }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<"figma" | "huggingface">("figma");
  const [assets, setAssets] = useState<ExternalAssetRecord[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [session, setSession] = useState<NetworkSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [figmaFormat, setFigmaFormat] = useState<"png" | "jpg" | "svg">("png");
  const [repoId, setRepoId] = useState("");
  const [repoType, setRepoType] = useState<"model" | "dataset" | "space">("model");
  const [revision, setRevision] = useState("main");
  const [repoFile, setRepoFile] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<"unverified" | "restricted">("unverified");

  const refresh = useCallback(async () => {
    const [assetsResponse, capabilityResponse] = await Promise.all([
      fetch("/api/external-assets"),
      fetch("/api/external-assets/capabilities"),
    ]);
    if (!assetsResponse.ok || !capabilityResponse.ok) throw new Error("External asset library is unavailable.");
    const assetsBody = await assetsResponse.json() as { assets?: ExternalAssetRecord[] };
    setAssets(assetsBody.assets ?? []);
    setCapabilities(await capabilityResponse.json() as Capabilities);
  }, []);

  useEffect(() => {
    void createNetworkSession().then(setSession).catch(error => toast({ title: "Network session unavailable", description: error instanceof Error ? error.message : String(error), variant: "destructive" }));
    void refresh().catch(() => undefined);
  }, [refresh, toast]);

  const importAsset = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const endpoint = provider === "figma" ? "/api/external-assets/figma" : "/api/external-assets/huggingface";
      const payload = provider === "figma"
        ? { fileKey, nodeId, format: figmaFormat, scale: 2, licenseStatus }
        : { repoId, repoType, revision, file: repoFile, licenseStatus };
      const result = await fetchWithApprovals(endpoint, payload, session);
      const asset = result.asset as ExternalAssetRecord | undefined;
      if (!asset?.sourceAssetId) throw new Error("Import completed without a source asset ID.");
      await refresh();
      onSelect(asset);
      toast({ title: `${provider === "figma" ? "Figma" : "Hugging Face"} asset imported`, description: `${asset.name} is selected as the current source.` });
    } catch (error) {
      toast({ title: "External asset import failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const providerReady = provider === "figma" ? capabilities?.figma.configured : true;
  const valid = provider === "figma" ? Boolean(fileKey.trim() && nodeId.trim()) : Boolean(repoId.trim() && repoFile.trim());

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Boxes className="h-4 w-4" />User asset library</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void refresh()}><RefreshCw className="h-3.5 w-3.5" /></Button></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant={provider === "figma" ? "default" : "outline"} onClick={() => setProvider("figma")}><Figma className="mr-1 h-3.5 w-3.5" />Figma</Button>
          <Button size="sm" variant={provider === "huggingface" ? "default" : "outline"} onClick={() => setProvider("huggingface")}><Boxes className="mr-1 h-3.5 w-3.5" />Hugging Face</Button>
        </div>

        {provider === "figma" ? (
          <div className="space-y-2">
            <Input value={fileKey} onChange={event => setFileKey(event.target.value)} placeholder="Figma file key" data-replay-mask />
            <Input value={nodeId} onChange={event => setNodeId(event.target.value)} placeholder="Node ID, e.g. 12:34" />
            <Select value={figmaFormat} onValueChange={value => setFigmaFormat(value as "png" | "jpg" | "svg")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="png">PNG · GUI raster</SelectItem><SelectItem value="svg">SVG · scalable UI</SelectItem><SelectItem value="jpg">JPG · background/photo</SelectItem></SelectContent></Select>
            {capabilities && !capabilities.figma.configured && <p className="text-[10px] text-destructive">FIGMA_ACCESS_TOKEN is missing from server secrets.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Input value={repoId} onChange={event => setRepoId(event.target.value)} placeholder="owner/repository" />
            <div className="grid grid-cols-2 gap-2"><Select value={repoType} onValueChange={value => setRepoType(value as "model" | "dataset" | "space")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="model">Model repo</SelectItem><SelectItem value="dataset">Dataset repo</SelectItem><SelectItem value="space">Space repo</SelectItem></SelectContent></Select><Input value={revision} onChange={event => setRevision(event.target.value)} placeholder="main" /></div>
            <Input value={repoFile} onChange={event => setRepoFile(event.target.value)} placeholder="path/to/asset.glb" />
            <p className="text-[10px] text-muted-foreground">Only explicit image, 3D, audio, video and JSON asset files are accepted. Weights and executable formats are blocked.</p>
          </div>
        )}

        <Select value={licenseStatus} onValueChange={value => setLicenseStatus(value as "unverified" | "restricted")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unverified">Unverified license · review required</SelectItem><SelectItem value="restricted">Restricted · preview only</SelectItem></SelectContent></Select>
        <Button className="w-full" disabled={busy || !session || !providerReady || !valid} onClick={() => void importAsset()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Import and use</Button>

        <div className="space-y-1 border-t pt-2">
          <div className="flex items-center justify-between text-[10px]"><span>My imported assets</span><Badge variant="outline">{assets.length}</Badge></div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {assets.length === 0 ? <p className="text-[10px] text-muted-foreground">No Figma or Hugging Face assets imported yet.</p> : assets.map(asset => (
              <button key={asset.id} type="button" className="flex w-full items-center justify-between rounded border bg-background/60 p-2 text-left text-[10px] hover:bg-muted" onClick={() => onSelect(asset)}>
                <span className="min-w-0"><strong className="block truncate">{asset.name}</strong><span className="block truncate text-muted-foreground">{asset.provider} · {asset.mimeType} · {(asset.byteLength / 1024).toFixed(0)} KB</span></span>
                <Badge variant="outline" className="ml-2 shrink-0">Use</Badge>
              </button>
            ))}
          </div>
        </div>

        {capabilities?.vercel.detected && <p className="text-[9px] text-muted-foreground">Vercel runtime detected: {capabilities.vercel.persistenceMode}. Configure external persistent storage before production asset publishing.</p>}
      </CardContent>
    </Card>
  );
}

async function createNetworkSession(): Promise<NetworkSession> {
  const response = await fetch("/api/network/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "ask_first", ttlMinutes: 120 }) });
  const body = await response.json() as { session?: { id: string; expiresAt: string }; token?: string; error?: string };
  if (!response.ok || !body.session || !body.token) throw new Error(body.error ?? "Network session creation failed.");
  return { id: body.session.id, expiresAt: body.session.expiresAt, token: body.token };
}

async function fetchWithApprovals(endpoint: string, payload: unknown, session: NetworkSession): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Network-Session-Id": session.id, "X-Network-Session-Token": session.token },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as Record<string, unknown> & { error?: string; code?: string; approval?: PendingApproval };
    if (response.ok) return body;
    if (response.status !== 409 || body.code !== "network_approval_required" || !body.approval) throw new Error(body.error ?? `Request failed with HTTP ${response.status}.`);
    const approval = body.approval;
    const approved = window.confirm(`Allow this exact external asset request?\n\nCapability: ${approval.capability}\nTarget: ${approval.targetOrigin}${approval.targetPath}\nReason: ${approval.reason}`);
    const decision = await fetch(`/api/network/sessions/${encodeURIComponent(session.id)}/approvals/${encodeURIComponent(approval.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Network-Session-Token": session.token },
      body: JSON.stringify({ decision: approved ? "approved" : "denied" }),
    });
    if (!approved || !decision.ok) throw new Error(approved ? "Network approval could not be recorded." : "External asset import was denied.");
  }
  throw new Error("External asset import required too many redirects or approvals.");
}
