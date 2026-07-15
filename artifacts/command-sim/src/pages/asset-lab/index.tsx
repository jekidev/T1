import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AssetJobSchema,
  type AssetGenerator,
  type AssetJob,
  type AssetJobRequest,
  type LicenseStatus,
} from "@workspace/asset-pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { withClientSpan } from "@/lib/telemetry";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Download,
  FileVideo,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";

type JobKind = AssetJobRequest["kind"];
type UserLicenseStatus = Exclude<LicenseStatus, "verified">;
type UserJobAction = "cancel" | "retry";

interface CapabilityResponse {
  providers: Array<{
    id: AssetGenerator;
    repository: string;
    runtime: string;
    productionRole: string;
    configured: boolean;
    notes: string;
  }>;
  blenderConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  workerAuthenticationConfigured: boolean;
  assetReviewConfigured: boolean;
}

export default function AssetLabPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [kind, setKind] = useState<JobKind>("image_to_3d");
  const [sourceId, setSourceId] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [presetId, setPresetId] = useState("civilian-standard-v1");
  const [clipName, setClipName] = useState("captured-motion");
  const [licenseStatus, setLicenseStatus] = useState<UserLicenseStatus>("unverified");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [jobs, setJobs] = useState<AssetJob[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);

  const refresh = useCallback(async () => {
    const [jobsResponse, capabilityResponse] = await Promise.all([
      fetch("/api/asset-generation/jobs?limit=100"),
      fetch("/api/asset-generation/capabilities"),
    ]);
    if (!jobsResponse.ok) throw new Error(`Jobs request failed with HTTP ${jobsResponse.status}.`);
    if (!capabilityResponse.ok) throw new Error(`Capability request failed with HTTP ${capabilityResponse.status}.`);
    const jobsBody = await jobsResponse.json() as { jobs?: unknown[] };
    setJobs((jobsBody.jobs ?? []).map(value => AssetJobSchema.parse(value)));
    setCapabilities(await capabilityResponse.json() as CapabilityResponse);
  }, []);

  useEffect(() => {
    void refresh().catch(error => toast({
      title: "Asset Lab unavailable",
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    }));
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 2_500);
    return () => window.clearInterval(interval);
  }, [refresh, toast]);

  const preferredGenerators = useMemo<AssetGenerator[]>(() => {
    if (kind === "image_to_3d") return ["hunyuan3d-2", "instantmesh", "triposr"];
    if (kind === "human_character") return ["mpfb2", "makehuman"];
    return ["freemocap", "mediapipe"];
  }, [kind]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploadedSourceId = await withClientSpan("asset.source.upload", {
        mimeType: file.type,
        bytes: file.size,
      }, async () => {
        const response = await fetch("/api/asset-generation/sources", {
          method: "POST",
          headers: { "Content-Type": file.type, "X-File-Name": file.name },
          body: file,
        });
        const body = await response.json() as { source?: { id?: string }; error?: string };
        if (!response.ok || !body.source?.id) throw new Error(body.error ?? `Upload failed with HTTP ${response.status}.`);
        return body.source.id;
      });
      setSourceId(uploadedSourceId);
      setSourceName(file.name);
      toast({ title: "Source uploaded", description: `${file.name} is ready for an asset job.` });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const createJob = async () => {
    if (kind !== "human_character" && !sourceId) {
      toast({
        title: "Source required",
        description: kind === "video_to_animation" ? "Upload a video first." : "Upload an image first.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const request: AssetJobRequest = kind === "image_to_3d"
        ? {
            kind,
            sourceAssetId: sourceId,
            generatorPreference: ["hunyuan3d-2", "instantmesh", "triposr"],
            assetType: "prop",
            targetPolygonCount: 50_000,
            lodCount: 3,
            removeBackground: true,
            licenseStatus,
            publishAfterValidation: false,
          }
        : kind === "human_character"
          ? {
              kind,
              generatorPreference: ["mpfb2", "makehuman"],
              presetId,
              skeletonId: "operation-kobenhavn-humanoid-v1",
              lodCount: 4,
              licenseStatus,
              publishAfterValidation: false,
            }
          : {
              kind,
              sourceAssetId: sourceId,
              generatorPreference: ["freemocap", "mediapipe"],
              skeletonId: "operation-kobenhavn-humanoid-v1",
              clipName,
              framesPerSecond: 30,
              footContactCorrection: true,
              temporalSmoothing: true,
              licenseStatus,
              publishAfterValidation: false,
            };

      await withClientSpan("asset.job.create", { kind, licenseStatus }, async () => {
        const response = await fetch("/api/asset-generation/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const body = await response.json() as { job?: unknown; error?: string };
        if (!response.ok || !body.job) throw new Error(body.error ?? `Job creation failed with HTTP ${response.status}.`);
        AssetJobSchema.parse(body.job);
      });
      toast({ title: "Asset job queued", description: "Generation will continue through the configured GPU and Blender workers." });
      setSourceId("");
      setSourceName("");
      await refresh();
    } catch (error) {
      toast({ title: "Job creation failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const mutateJob = async (jobId: string, action: UserJobAction) => {
    try {
      await withClientSpan(`asset.job.${action}`, { jobId }, async () => {
        const response = await fetch(`/api/asset-generation/jobs/${encodeURIComponent(jobId)}/${action}`, { method: "POST" });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? `${action} failed with HTTP ${response.status}.`);
      });
      toast({ title: `Asset job ${action} requested` });
      await refresh();
    } catch (error) {
      toast({ title: `Cannot ${action} asset`, description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-semibold">AI Asset Lab</h1>
              <p className="text-xs text-muted-foreground">GPU generation → Blender headless → validation → licensed review → manifest</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Create asset job</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={kind} onValueChange={value => { setKind(value as JobKind); setSourceId(""); setSourceName(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image_to_3d">Image → 3D prop/building</SelectItem>
                    <SelectItem value="human_character">Parametric human</SelectItem>
                    <SelectItem value="video_to_animation">Video → animation</SelectItem>
                  </SelectContent>
                </Select>

                {kind !== "human_character" && (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed p-5 text-center">
                    {kind === "video_to_animation" ? <FileVideo className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                    <span className="text-xs">{sourceName || (kind === "video_to_animation" ? "Upload MP4 or WebM" : "Upload PNG, JPEG or WebP")}</span>
                    <input
                      className="hidden"
                      type="file"
                      accept={kind === "video_to_animation" ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp"}
                      onChange={event => void handleFile(event.target.files?.[0])}
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </label>
                )}

                {kind === "human_character" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Role/faction preset</label>
                    <Input value={presetId} onChange={event => setPresetId(event.target.value)} data-replay-mask />
                    <p className="text-[10px] text-muted-foreground">Uses MPFB2/MakeHuman and the standard humanoid skeleton.</p>
                  </div>
                )}

                {kind === "video_to_animation" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Animation clip name</label>
                    <Input value={clipName} onChange={event => setClipName(event.target.value)} />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium">Source license state</label>
                  <Select value={licenseStatus} onValueChange={value => setLicenseStatus(value as UserLicenseStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unverified">Unverified — admin review required</SelectItem>
                      <SelectItem value="restricted">Restricted — cannot publish</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Browser users cannot mark assets as verified.</p>
                </div>

                <div className="rounded border p-2 text-[10px] text-muted-foreground">Preferred route: {preferredGenerators.join(" → ")}</div>
                <Button className="w-full" disabled={creating || uploading} onClick={() => void createJob()}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Queue generation
                </Button>
              </CardContent>
            </Card>

            <CapabilityCard capabilities={capabilities} />
          </div>

          <div className="space-y-3">
            {jobs.length === 0
              ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No asset jobs yet.</CardContent></Card>
              : jobs.map(job => <JobCard key={job.id} job={job} onAction={mutateJob} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ capabilities }: { capabilities: CapabilityResponse | null }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Worker readiness</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-xs">
        {!capabilities ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Readiness label="Blender worker" ready={capabilities.blenderConfigured} />
            <Readiness label="Public callback URL" ready={capabilities.publicBaseUrlConfigured} />
            <Readiness label="Worker authentication" ready={capabilities.workerAuthenticationConfigured} />
            <Readiness label="Admin asset review" ready={capabilities.assetReviewConfigured} />
            <div className="space-y-1 pt-2">
              {capabilities.providers.map(provider => (
                <div key={provider.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div><div className="font-medium">{provider.id}</div><div className="text-[9px] text-muted-foreground">{provider.productionRole} · {provider.runtime}</div></div>
                  <Badge variant={provider.configured ? "default" : "outline"}>{provider.configured ? "ready" : "offline"}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Readiness({ label, ready }: { label: string; ready: boolean }) {
  return <div className="flex items-center justify-between"><span>{label}</span>{ready ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</div>;
}

function JobCard({ job, onAction }: { job: AssetJob; onAction: (id: string, action: UserJobAction) => Promise<void> }) {
  const preview = job.artifacts.find(artifact => artifact.kind === "preview" && artifact.mimeType.startsWith("image/"));
  const downloadable = job.artifacts.filter(artifact => ["glb", "animation", "report"].includes(artifact.kind));
  const statusVariant = job.status === "published" ? "default" : job.status === "failed" ? "destructive" : "outline";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              {job.request.kind === "human_character" ? <UserRound className="h-4 w-4" /> : job.request.kind === "video_to_animation" ? <FileVideo className="h-4 w-4" /> : <Box className="h-4 w-4" />}
              {job.request.kind.replaceAll("_", " ")}
            </CardTitle>
            <p className="mt-1 break-all text-[9px] text-muted-foreground">{job.id}</p>
          </div>
          <Badge variant={statusVariant}>{job.status.replaceAll("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span>Generator: {job.selectedGenerator ?? "pending"}</span>
          <span>License: {job.metadata?.licenseStatus ?? job.request.licenseStatus}</span>
          <span>Artifacts: {job.artifacts.length}</span>
        </div>

        {preview && (
          <div className="overflow-hidden rounded border bg-muted/20">
            <img
              src={`/api/asset-generation/jobs/${encodeURIComponent(job.id)}/artifacts/${preview.sha256}`}
              alt="Generated asset preview"
              className="max-h-72 w-full object-contain"
              data-replay-block
            />
          </div>
        )}

        {job.metadata && (
          <div className="grid grid-cols-2 gap-2 rounded border p-2 text-[10px]">
            <span>Polygons: {job.metadata.polygonCount.toLocaleString()}</span>
            <span>LODs: {job.metadata.lodCount}</span>
            <span>Texture: {(job.metadata.textureMemoryBytes / 1024 / 1024).toFixed(1)} MB</span>
            <span>Skeleton: {job.metadata.skeletonId ?? "n/a"}</span>
          </div>
        )}

        {job.validation && job.validation.issues.length > 0 && (
          <div className="space-y-1 rounded border p-2 text-[10px]">
            {job.validation.issues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className={issue.severity === "error" ? "text-destructive" : "text-muted-foreground"}>
                {issue.code}: {issue.message}
              </div>
            ))}
          </div>
        )}

        {job.error && <div className="rounded border border-destructive/50 p-2 text-xs text-destructive">{job.error.code}: {job.error.message}</div>}
        {job.status === "awaiting_review" && (
          <div className="rounded border p-2 text-[10px] text-muted-foreground">
            Preview is ready. A server-side reviewer must verify the license and publish through the protected review API.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {downloadable.map(artifact => (
            <Button key={artifact.sha256} asChild size="sm" variant="outline">
              <a href={`/api/asset-generation/jobs/${encodeURIComponent(job.id)}/artifacts/${artifact.sha256}`} download>
                <Download className="mr-1 h-3.5 w-3.5" />{artifact.kind}
              </a>
            </Button>
          ))}
          {job.status === "failed" || job.status === "cancelled" ? (
            <Button size="sm" variant="outline" onClick={() => void onAction(job.id, "retry")}><RefreshCw className="mr-1 h-3.5 w-3.5" />Retry</Button>
          ) : !["published", "awaiting_review"].includes(job.status) ? (
            <Button size="sm" variant="outline" onClick={() => void onAction(job.id, "cancel")}><PauseCircle className="mr-1 h-3.5 w-3.5" />Cancel</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
