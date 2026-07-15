import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { WorkspacePreflight } from "@/components/workspace-preflight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createWorkflow,
  loadWorkspaceState,
  newWorkflowStep,
  saveWorkspaceState,
  type IntegratedRepository,
  type UserWorkspaceState,
  type WorkflowStepKind,
  type WorkspaceAsset,
  type WorkspaceHyperlink,
  type WorkspacePlugin,
  type WorkspaceWorkflowStep,
} from "@/lib/workspace";
import { ArrowLeft, Box, ExternalLink, Github, Link2, Loader2, PackagePlus, Plug, Plus, Save, Star, Trash2, Workflow } from "lucide-react";

interface GithubRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  updatedAt: string;
  stars: number;
  owner: string;
}

export default function WorkspacePage() {
  const [, setLocation] = useLocation();
  const [workspace, setWorkspace] = useState<UserWorkspaceState>(() => loadWorkspaceState());
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoScope, setRepoScope] = useState<"owned" | "starred">("owned");
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [assetOrigin, setAssetOrigin] = useState<WorkspaceAsset["origin"]>("upload");
  const [assetBusy, setAssetBusy] = useState(false);
  const [pluginName, setPluginName] = useState("");
  const [pluginDescription, setPluginDescription] = useState("");
  const [pluginCategory, setPluginCategory] = useState<WorkspacePlugin["category"]>("integration");
  const [pluginRepositoryId, setPluginRepositoryId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState("Reference");
  const [workflowName, setWorkflowName] = useState("Custom Workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkspaceWorkflowStep[]>([]);
  const [stepKind, setStepKind] = useState<WorkflowStepKind>("talk");
  const [message, setMessage] = useState("");

  useEffect(() => saveWorkspaceState(workspace), [workspace]);

  const loadRepos = async (scope: "owned" | "starred") => {
    setRepoBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workspace/github/repos?scope=${scope}`, { credentials: "include" });
      const body = await response.json() as { repos?: GithubRepo[]; error?: string };
      if (!response.ok || !body.repos) throw new Error(body.error ?? "GitHub repository request failed.");
      setRepos(body.repos);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRepoBusy(false);
    }
  };

  useEffect(() => { void loadRepos(repoScope); }, [repoScope]);

  const createRepo = async () => {
    if (!repoName.trim()) return;
    setRepoBusy(true);
    try {
      const response = await fetch("/api/workspace/github/repos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: repoName.trim(), description: repoDescription.trim(), private: true, autoInit: true }),
      });
      const body = await response.json() as { repo?: GithubRepo; error?: string };
      if (!response.ok || !body.repo) throw new Error(body.error ?? "Repository creation failed.");
      setRepos(current => [body.repo!, ...current]);
      setRepoName("");
      setRepoDescription("");
      setMessage(`Created ${body.repo.fullName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRepoBusy(false);
    }
  };

  const integrateRepo = (repo: GithubRepo) => {
    const integration: IntegratedRepository = {
      id: repo.id,
      fullName: repo.fullName,
      htmlUrl: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      defaultBranch: repo.defaultBranch,
      integratedAt: new Date().toISOString(),
    };
    setWorkspace(current => ({ ...current, repositories: [...current.repositories.filter(item => item.id !== repo.id), integration] }));
    setWorkflowSteps(current => [...current, {
      ...newWorkflowStep("integrate_github_repo", `Integrate ${repo.fullName}`),
      prompt: `Analyze and integrate ${repo.fullName} from ${repo.cloneUrl}. Use branch ${repo.defaultBranch}. Check license, architecture and compatibility before building an adapter.`,
      config: { repository: repo.fullName, cloneUrl: repo.cloneUrl, defaultBranch: repo.defaultBranch },
    }]);
    setMessage(`${repo.fullName} added to the workflow composer.`);
  };

  const registerPlugin = () => {
    const repository = workspace.repositories.find(item => item.id === pluginRepositoryId);
    if (!pluginName.trim() || !repository) return;
    const plugin: WorkspacePlugin = {
      id: `plugin-repo-${repository.id}-${crypto.randomUUID()}`,
      name: pluginName.trim().slice(0, 160),
      description: (pluginDescription.trim() || `Adapter proposal based on ${repository.fullName}.`).slice(0, 1000),
      enabled: false,
      category: pluginCategory,
      sourceRepository: repository.fullName,
      installedAt: new Date().toISOString(),
    };
    setWorkspace(current => ({ ...current, plugins: [...current.plugins, plugin] }));
    setWorkflowSteps(current => [...current, {
      ...newWorkflowStep("integrate_github_repo", `Build plugin adapter: ${plugin.name}`),
      prompt: `Inspect ${repository.fullName} and design a lazy-loaded plugin adapter named ${plugin.name}. Do not execute repository code directly. Check license, package health, browser compatibility, permissions, bundle impact and tests before proposing additive integration changes.`,
      config: { repository: repository.fullName, pluginId: plugin.id, category: plugin.category },
    }]);
    setPluginName("");
    setPluginDescription("");
    setPluginRepositoryId("");
    setMessage(`${plugin.name} registered as disabled. Its adapter step was added to the workflow composer.`);
  };

  const uploadAsset = async (file: File) => {
    setAssetBusy(true);
    try {
      const response = await fetch("/api/asset-generation/sources", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file,
      });
      const body = await response.json() as { source?: { id: string; mimeType: string }; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Asset upload failed.");
      const asset: WorkspaceAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: body.source.mimeType,
        sourceId: body.source.id,
        sourceUrl: `/api/asset-generation/sources/${encodeURIComponent(body.source.id)}`,
        origin: assetOrigin,
        createdAt: new Date().toISOString(),
      };
      setWorkspace(current => ({ ...current, assets: [asset, ...current.assets] }));
      setMessage(`${file.name} added to the shared asset library.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setAssetBusy(false);
    }
  };

  const saveWorkflow = () => {
    if (!workflowName.trim() || workflowSteps.length === 0) return;
    const workflow = createWorkflow(workflowName.trim(), workflowDescription.trim(), workflowSteps);
    setWorkspace(current => ({ ...current, workflows: [...current.workflows, workflow] }));
    setWorkflowSteps([]);
    setWorkflowName("Custom Workflow");
    setWorkflowDescription("");
    setMessage(`Workflow ${workflow.name} saved.`);
  };

  const groupedLinks = useMemo(
    () => workspace.hyperlinks.reduce<Record<string, WorkspaceHyperlink[]>>((groups, link) => {
      (groups[link.category] ??= []).push(link);
      return groups;
    }, {}),
    [workspace.hyperlinks],
  );

  return (
    <div className="min-h-screen select-text bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.2))] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/90 p-4 shadow-xl shadow-primary/5 backdrop-blur">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-xl font-bold">Workspace & Integrations</h1><p className="text-xs text-muted-foreground">Connections, GitHub, assets, plugins, hyperlinks and composable LLM workflows.</p></div></div>
          <Badge variant="outline">Secrets are session-only</Badge>
        </header>

        <Tabs defaultValue="connections" className="space-y-4">
          <TabsList className="h-auto flex-wrap rounded-xl border bg-card/90 p-1 shadow-inner">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="plugins">Plugins</TabsTrigger>
            <TabsTrigger value="hyperlinks">Hyperlinks</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
          </TabsList>

          <TabsContent value="connections"><WorkspacePreflight compact /></TabsContent>

          <TabsContent value="github" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <Card className="shadow-lg"><CardHeader><CardTitle className="text-sm">Create repository</CardTitle><CardDescription>Creates a private initialized repository in the authenticated GitHub account.</CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Name</Label><Input value={repoName} onChange={event => setRepoName(event.target.value)} placeholder="new-game-module" /></div><div><Label>Description</Label><Textarea value={repoDescription} onChange={event => setRepoDescription(event.target.value)} /></div><Button className="w-full" disabled={repoBusy || !repoName.trim()} onClick={() => void createRepo()}><Plus className="mr-2 h-4 w-4" />Create private repo</Button></CardContent></Card>
              <Card className="shadow-lg"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-sm">Repository browser</CardTitle><CardDescription>Owned and starred repositories can be attached to an integration workflow.</CardDescription></div><div className="flex gap-2"><Button variant={repoScope === "owned" ? "default" : "outline"} size="sm" onClick={() => setRepoScope("owned")}><Github className="mr-1 h-3.5 w-3.5" />Owned</Button><Button variant={repoScope === "starred" ? "default" : "outline"} size="sm" onClick={() => setRepoScope("starred")}><Star className="mr-1 h-3.5 w-3.5" />Starred</Button></div></div></CardHeader><CardContent>{repoBusy ? <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div> : <div className="grid gap-2 md:grid-cols-2">{repos.map(repo => <div key={repo.id} className="rounded-lg border bg-background/60 p-3 shadow-inner"><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-medium">{repo.fullName}</div><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{repo.description || "No description"}</p></div><Badge variant="outline">{repo.private ? "private" : `${repo.stars}★`}</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" className="h-7 flex-1 text-[10px]" onClick={() => integrateRepo(repo)}><Workflow className="mr-1 h-3 w-3" />Integrate</Button><Button size="icon" variant="outline" className="h-7 w-7" onClick={() => window.open(repo.htmlUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-3 w-3" /></Button></div></div>)}</div>}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Box className="h-4 w-4" />Universal user assets</CardTitle><CardDescription>Upload images or video exported from ChatGPT, Grok or other tools. Files are stored through the existing validated asset pipeline and synchronized to the authenticated account after preflight.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-[220px_1fr]"><Select value={assetOrigin} onValueChange={value => setAssetOrigin(value as WorkspaceAsset["origin"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="upload">Local upload</SelectItem><SelectItem value="chatgpt">ChatGPT</SelectItem><SelectItem value="grok">Grok</SelectItem><SelectItem value="other">Other generator</SelectItem></SelectContent></Select><Input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" disabled={assetBusy} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file); event.currentTarget.value = ""; }} /></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{workspace.assets.map(asset => <div key={asset.id} className="overflow-hidden rounded-lg border bg-background/70 shadow-md"><div className="aspect-video bg-muted">{asset.mimeType.startsWith("image/") ? <img src={asset.sourceUrl} alt={asset.name} className="h-full w-full object-cover" /> : <video src={asset.sourceUrl} controls className="h-full w-full object-cover" />}</div><div className="p-2"><div className="truncate text-xs font-medium">{asset.name}</div><div className="text-[9px] text-muted-foreground">{asset.origin} · {asset.mimeType}</div></div></div>)}</div></CardContent></Card>
          </TabsContent>

          <TabsContent value="plugins" className="space-y-4">
            <Card className="border-primary/20 shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><PackagePlus className="h-4 w-4" />Register repository plugin</CardTitle><CardDescription>Registers metadata and creates an adapter workflow. Repository code is never executed or bundled automatically.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_1fr_auto]"><Input value={pluginName} onChange={event => setPluginName(event.target.value)} placeholder="Plugin name" /><Input value={pluginDescription} onChange={event => setPluginDescription(event.target.value)} placeholder="Purpose and capabilities" /><Select value={pluginCategory} onValueChange={value => setPluginCategory(value as WorkspacePlugin["category"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="core">Core</SelectItem><SelectItem value="mcp">MCP</SelectItem><SelectItem value="integration">Integration</SelectItem><SelectItem value="visual">Visual</SelectItem></SelectContent></Select><Select value={pluginRepositoryId} onValueChange={setPluginRepositoryId}><SelectTrigger><SelectValue placeholder="Integrated repository" /></SelectTrigger><SelectContent>{workspace.repositories.map(repo => <SelectItem key={repo.id} value={repo.id}>{repo.fullName}</SelectItem>)}</SelectContent></Select><Button disabled={!pluginName.trim() || !pluginRepositoryId} onClick={registerPlugin}><Plug className="mr-1 h-4 w-4" />Register</Button></CardContent></Card>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workspace.plugins.map(plugin => <Card key={plugin.id} className={`shadow-lg transition ${plugin.enabled ? "border-primary/40 bg-primary/5" : "opacity-70"}`}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-sm"><Plug className="h-4 w-4" />{plugin.name}</CardTitle><CardDescription>{plugin.description}</CardDescription></div><Badge variant="outline">{plugin.category}</Badge></div></CardHeader><CardContent className="space-y-2">{plugin.sourceRepository && <button type="button" className="text-left text-[10px] text-primary underline-offset-2 hover:underline" onClick={() => window.open(`https://github.com/${plugin.sourceRepository}`, "_blank", "noopener,noreferrer")}>{plugin.sourceRepository}</button>}<Button className="w-full" variant={plugin.enabled ? "default" : "outline"} onClick={() => setWorkspace(current => ({ ...current, plugins: current.plugins.map(item => item.id === plugin.id ? { ...item, enabled: !item.enabled } : item) }))}>{plugin.enabled ? "Enabled" : "Enable plugin"}</Button>{plugin.id.startsWith("plugin-repo-") && <Button className="w-full" variant="ghost" onClick={() => setWorkspace(current => ({ ...current, plugins: current.plugins.filter(item => item.id !== plugin.id) }))}><Trash2 className="mr-1 h-3.5 w-3.5" />Remove registration</Button>}</CardContent></Card>)}</div>
          </TabsContent>

          <TabsContent value="hyperlinks" className="space-y-4"><Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Link2 className="h-4 w-4" />Quick launch links</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_auto]"><Input value={linkLabel} onChange={event => setLinkLabel(event.target.value)} placeholder="Label" /><Input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://…" /><Input value={linkCategory} onChange={event => setLinkCategory(event.target.value)} placeholder="Category" /><Button onClick={() => { try { const url = new URL(linkUrl); if (url.protocol !== "https:") throw new Error("HTTPS required"); setWorkspace(current => ({ ...current, hyperlinks: [...current.hyperlinks, { id: crypto.randomUUID(), label: linkLabel.trim() || url.hostname, url: url.toString(), category: linkCategory.trim() || "Reference" }] })); setLinkLabel(""); setLinkUrl(""); } catch { setMessage("Enter a valid HTTPS link."); } }} disabled={!linkUrl.trim()}><Plus className="h-4 w-4" /></Button></div>{Object.entries(groupedLinks).map(([category, links]) => <div key={category}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h3><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{links.map(link => <div key={link.id} className="flex items-center gap-2 rounded border bg-background/60 p-2 shadow-inner"><Button variant="ghost" className="h-auto flex-1 justify-start" onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-3.5 w-3.5" />{link.label}</Button><Button variant="ghost" size="icon" onClick={() => setWorkspace(current => ({ ...current, hyperlinks: current.hyperlinks.filter(item => item.id !== link.id) }))}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div></div>)}</CardContent></Card></TabsContent>

          <TabsContent value="workflows" className="space-y-4"><div className="grid gap-4 lg:grid-cols-[380px_1fr]"><Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><PackagePlus className="h-4 w-4" />Workflow composer</CardTitle><CardDescription>Combine Talk, Plan, Build, Storyline, GitHub, assets, RAG and Telegram into one saved workflow.</CardDescription></CardHeader><CardContent className="space-y-3"><Input value={workflowName} onChange={event => setWorkflowName(event.target.value)} /><Textarea value={workflowDescription} onChange={event => setWorkflowDescription(event.target.value)} placeholder="Workflow purpose" /><div className="flex gap-2"><Select value={stepKind} onValueChange={value => setStepKind(value as WorkflowStepKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["talk","plan","build","create_storyline","integrate_github_repo","import_asset","update_world","scan_telegram_people","custom_prompt"] as WorkflowStepKind[]).map(kind => <SelectItem key={kind} value={kind}>{kind.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select><Button onClick={() => setWorkflowSteps(current => [...current, newWorkflowStep(stepKind)])}><Plus className="h-4 w-4" /></Button></div><div className="space-y-2">{workflowSteps.map((step, index) => <div key={step.id} className="rounded border bg-background/60 p-2 shadow-inner"><div className="flex items-center gap-2"><Badge variant="outline">{index + 1}</Badge><Input className="h-7" value={step.title} onChange={event => setWorkflowSteps(current => current.map(item => item.id === step.id ? { ...item, title: event.target.value } : item))} /><Button variant="ghost" size="icon" onClick={() => setWorkflowSteps(current => current.filter(item => item.id !== step.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div><Textarea className="mt-2 min-h-16 text-xs" value={step.prompt} onChange={event => setWorkflowSteps(current => current.map(item => item.id === step.id ? { ...item, prompt: event.target.value } : item))} placeholder="Step prompt and acceptance criteria" /></div>)}</div><Button className="w-full" disabled={!workflowName.trim() || workflowSteps.length === 0} onClick={saveWorkflow}><Save className="mr-2 h-4 w-4" />Save workflow</Button></CardContent></Card><div className="space-y-3">{workspace.workflows.map(workflow => <Card key={workflow.id} className="shadow-lg"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-sm">{workflow.name}</CardTitle><CardDescription>{workflow.description}</CardDescription></div><Badge>{workflow.steps.length} steps</Badge></div></CardHeader><CardContent><div className="flex flex-wrap gap-2">{workflow.steps.map((step, index) => <Badge key={step.id} variant="outline">{index + 1}. {step.kind.replaceAll("_", " ")}</Badge>)}</div><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => setWorkflowSteps(current => [...current, ...workflow.steps.map(step => ({ ...step, id: crypto.randomUUID() }))])}><Plus className="mr-1 h-3.5 w-3.5" />Combine</Button>{!workflow.id.startsWith("workflow-") && <Button variant="ghost" size="sm" onClick={() => setWorkspace(current => ({ ...current, workflows: current.workflows.filter(item => item.id !== workflow.id) }))}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>}</div></CardContent></Card>)}</div></div></TabsContent>
        </Tabs>

        {message && <div className="rounded-lg border bg-card/90 p-3 text-sm shadow-lg">{message}</div>}
      </div>
    </div>
  );
}
