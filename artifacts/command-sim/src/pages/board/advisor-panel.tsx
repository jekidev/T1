import { useState, useRef, useEffect, useMemo } from "react";
import {
  applySyndicateCommand,
  type Syndicate,
} from "@workspace/strategy-sim";
import { useBoardStore, ADVISOR_ROLES, type AdvisorRole } from "@/lib/game";
import { useSendAdvisorMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  BookOpen,
  Bot,
  Check,
  ClipboardPaste,
  CloudDownload,
  Copy,
  Download,
  GlobeLock,
  Hammer,
  HeartPulse,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Scale,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  TextSelect,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  buildAiProfileContext,
  createAiProfile,
  loadActiveAiProfileId,
  loadAiProfiles,
  saveActiveAiProfileId,
  saveAiProfiles,
  type AiWorkspaceProfile,
} from "@/lib/ai-workspace";
import {
  loadWorkspaceState,
  saveWorkspaceState,
  WORKSPACE_UPDATED_EVENT,
  type LlmWorkspaceMode,
  type UserWorkspaceState,
} from "@/lib/workspace";
import {
  applyAdvisorBuildProposal,
  buildAdvisorWorkspacePrompt,
  createStorylineWorkflowPrompts,
  extractAdvisorBuildProposal,
  type AdvisorBuildProposal,
} from "@/lib/advisor-workflow";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: LlmWorkspaceMode;
}

type NetworkMode = "ask_first" | "ultra";

interface NetworkSession {
  id: string;
  token: string;
  mode: NetworkMode;
  expiresAt: string;
}

interface PendingApproval {
  id: string;
  targetOrigin: string;
  targetPath: string;
  reason: string;
  capability: string;
}

const CHAT_MODES: Array<{
  id: LlmWorkspaceMode;
  label: string;
  icon: typeof MessageCircle;
  description: string;
}> = [
  { id: "talk", label: "Talk", icon: MessageCircle, description: "Discuss, question and develop ideas without mutating state." },
  { id: "plan", label: "Plan", icon: ListChecks, description: "Produce dependencies, risks, acceptance criteria and an ordered plan." },
  { id: "build", label: "Build", icon: Hammer, description: "Generate an additive proposal that can be reviewed and applied." },
];

export function AdvisorPanel() {
  const { board, loadBoard, scenarioId, scenarioName, scenarioDescription } = useBoardStore();
  const [selectedRole, setSelectedRole] = useState<AdvisorRole>("neutral_analyst");
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    mode: "talk",
    content: "AI Advisor initialized in Talk mode. Internet search is blocked by default. Talk, Plan and Build use the same board, workspace profile and selected moral stance.",
  }]);
  const [input, setInput] = useState("");
  const [profiles, setProfiles] = useState<AiWorkspaceProfile[]>(() => loadAiProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => loadActiveAiProfileId());
  const [workspaceState, setWorkspaceState] = useState<UserWorkspaceState>(() => loadWorkspaceState());
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [networkMode, setNetworkMode] = useState<NetworkMode>("ask_first");
  const [networkSession, setNetworkSession] = useState<NetworkSession | null>(null);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [storylineBusy, setStorylineBusy] = useState(false);
  const [pendingBuild, setPendingBuild] = useState<AdvisorBuildProposal | null>(null);
  const [accountName, setAccountName] = useState("default");
  const [hfRepoId, setHfRepoId] = useState("");
  const [hfRevision, setHfRevision] = useState("main");
  const [hfFiles, setHfFiles] = useState("README.md");
  const sendMessageMutation = useSendAdvisorMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const networkInitialized = useRef(false);
  const { toast } = useToast();

  const roleMeta = ADVISOR_ROLES.find(role => role.id === selectedRole);
  const isRedTeam = selectedRole === "red_team_risk_model";
  const activeProfile = profiles.find(profile => profile.id === activeProfileId) ?? profiles[0];
  const meters = useMemo(() => calculateMeters(board), [board]);
  const activeModeMeta = CHAT_MODES.find(mode => mode.id === workspaceState.chatMode) ?? CHAT_MODES[0]!;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sendMessageMutation.isPending, storylineBusy]);
  useEffect(() => { saveAiProfiles(profiles); }, [profiles]);
  useEffect(() => { saveActiveAiProfileId(activeProfileId); }, [activeProfileId]);
  useEffect(() => {
    const listener = (event: Event) => {
      const update = (event as CustomEvent<UserWorkspaceState>).detail;
      if (update?.version === 1) setWorkspaceState(update);
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, listener);
    return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, listener);
  }, []);
  useEffect(() => {
    if (networkInitialized.current) return;
    networkInitialized.current = true;
    void createNetworkSession("ask_first").then(setNetworkSession).catch(error => {
      toast({ title: "Network gate unavailable", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    });
  }, [toast]);

  const updateActiveProfile = (update: (profile: AiWorkspaceProfile) => AiWorkspaceProfile) => {
    setProfiles(current => current.map(profile => profile.id === activeProfileId ? update(profile) : profile));
  };

  const updateWorkspace = (update: (state: UserWorkspaceState) => UserWorkspaceState) => {
    setWorkspaceState(current => {
      const next = update(current);
      saveWorkspaceState(next);
      return next;
    });
  };

  const setChatMode = (mode: LlmWorkspaceMode) => {
    updateWorkspace(current => ({ ...current, chatMode: mode }));
  };

  const copyText = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (typeof index === "number") {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1200);
      }
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Clipboard access failed", variant: "destructive" });
    }
  };

  const copyConversation = () => copyText(messages.map(message => `${message.role === "user" ? "YOU" : "AI"}${message.mode ? ` [${message.mode.toUpperCase()}]` : ""}:\n${message.content}`).join("\n\n---\n\n"));

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(current => current ? `${current}\n${text}` : text);
      inputRef.current?.focus();
    } catch {
      toast({ title: "Clipboard read permission was not granted", variant: "destructive" });
    }
  };

  const selectInput = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const networkContext = () => networkMode === "ask_first"
    ? "Internet policy: ASK FIRST. No web search or web fetch is approved. Do not claim current web research. Ask the user before any external retrieval tool is used."
    : "Internet policy: ULTRA for this temporary user-approved session. Only public HTTPS retrieval through the server network gate is permitted; protected paths, secrets and private-network targets remain blocked.";

  const requestAdvisor = async (inputRequest: {
    request: string;
    mode: LlmWorkspaceMode;
    role: AdvisorRole;
    history: Message[];
  }): Promise<string> => {
    if (!activeProfile) throw new Error("No active AI profile is available.");
    const response = await sendMessageMutation.mutateAsync({
      data: {
        role: inputRequest.role,
        message: buildAdvisorWorkspacePrompt({
          profileContext: buildAiProfileContext(activeProfile),
          workspace: workspaceState,
          mode: inputRequest.mode,
          networkContext: networkContext(),
          request: inputRequest.request,
        }),
        board: board as never,
        history: inputRequest.history.map(message => ({ role: message.role, content: message.content })),
      },
    });
    return response.reply;
  };

  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending || storylineBusy || !activeProfile) return;
    const userMsg = input.trim();
    const mode = workspaceState.chatMode;
    const history = [...messages];
    setInput("");
    setMessages(current => [...current, { role: "user", content: userMsg, mode }]);
    try {
      const reply = await requestAdvisor({ request: userMsg, mode, role: selectedRole, history });
      setMessages(current => [...current, { role: "assistant", content: reply, mode }]);
      if (mode === "build") {
        const proposal = extractAdvisorBuildProposal(reply);
        if (proposal) {
          setPendingBuild(proposal);
          toast({ title: "Build proposal ready", description: "Review it in chat, then press Apply build proposal." });
        }
      }
    } catch {
      setMessages(current => [...current, { role: "assistant", content: "[ERROR: Communication with advisor failed. Check API connection.]", mode }]);
    }
  };

  const runStorylineWorkflow = async () => {
    if (storylineBusy || sendMessageMutation.isPending || !activeProfile) return;
    setStorylineBusy(true);
    setSelectedRole("story_director");
    setPendingBuild(null);
    const steps = createStorylineWorkflowPrompts({
      scenarioName,
      scenarioDescription,
      moralSpectrum: workspaceState.llmMoralSpectrum,
      currentStoryline: board.generatedContent?.storyline,
    });
    let workflowHistory = [...messages];
    try {
      for (const step of steps) {
        setChatMode(step.mode);
        const userMessage: Message = { role: "user", content: step.prompt, mode: step.mode };
        workflowHistory = [...workflowHistory, userMessage];
        setMessages(current => [...current, userMessage]);
        const reply = await requestAdvisor({
          request: step.prompt,
          mode: step.mode,
          role: "story_director",
          history: workflowHistory,
        });
        const assistantMessage: Message = { role: "assistant", content: reply, mode: step.mode };
        workflowHistory = [...workflowHistory, assistantMessage];
        setMessages(current => [...current, assistantMessage]);
        if (step.mode === "build") {
          const proposal = extractAdvisorBuildProposal(reply);
          if (proposal) setPendingBuild(proposal);
        }
      }
      toast({
        title: "Create Storyline completed",
        description: pendingBuild ? "Talk, Plan and Build completed." : "Workflow completed. Apply appears when the Build response contains valid JSON.",
      });
    } catch (error) {
      setMessages(current => [...current, {
        role: "assistant",
        mode: workspaceState.chatMode,
        content: `[ERROR: Create Storyline stopped: ${error instanceof Error ? error.message : String(error)}]`,
      }]);
    } finally {
      setStorylineBusy(false);
    }
  };

  const applyPendingBuild = () => {
    if (!pendingBuild) return;
    const nextBoard = applyAdvisorBuildProposal(board, pendingBuild);
    loadBoard(nextBoard, scenarioId, scenarioName, scenarioDescription);
    setPendingBuild(null);
    toast({ title: "Build proposal applied", description: "The proposal was added to the board without deleting existing content." });
  };

  const changeNetworkMode = async (mode: NetworkMode) => {
    setNetworkBusy(true);
    try {
      if (!networkSession) {
        const created = await createNetworkSession(mode);
        setNetworkSession(created);
        setNetworkMode(created.mode);
      } else {
        const response = await fetch(`/api/network/sessions/${encodeURIComponent(networkSession.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Network-Session-Token": networkSession.token },
          body: JSON.stringify({ mode }),
        });
        const body = await response.json() as { session?: { id: string; mode: NetworkMode; expiresAt: string }; error?: string };
        if (!response.ok || !body.session) throw new Error(body.error ?? "Network mode update failed.");
        setNetworkSession({ id: body.session.id, mode: body.session.mode, expiresAt: body.session.expiresAt, token: networkSession.token });
        setNetworkMode(mode);
      }
      toast({
        title: mode === "ask_first" ? "Ask First enabled" : "Ultra enabled",
        description: mode === "ask_first" ? "Every external retrieval requires a separate approval." : "Public HTTPS retrieval is pre-approved for this temporary audited session.",
      });
    } catch (error) {
      toast({ title: "Network mode failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setNetworkBusy(false);
    }
  };

  const importArtOfWar = async () => {
    await runNetworkImport("/api/rag/import/art-of-war", { accountName }, "The Art of War imported into account RAG");
  };

  const importHuggingFace = async () => {
    const files = hfFiles.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
    await runNetworkImport("/api/rag/import/huggingface", { accountName, repoId: hfRepoId, revision: hfRevision, files }, "Hugging Face text files imported into RAG");
  };

  const runNetworkImport = async (endpoint: string, payload: unknown, successTitle: string) => {
    if (!networkSession) {
      toast({ title: "Network session is not ready", variant: "destructive" });
      return;
    }
    setNetworkBusy(true);
    try {
      const result = await fetchWithApprovals(endpoint, payload, networkSession, networkMode);
      toast({ title: successTitle, description: typeof result.ragRevision === "string" ? `RAG revision ${result.ragRevision.slice(0, 12)}` : undefined });
    } catch (error) {
      toast({ title: "RAG import failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setNetworkBusy(false);
    }
  };

  const updateWorld = async () => {
    setNetworkBusy(true);
    try {
      const response = await fetch("/api/rag/update-world", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json() as { ragRevision?: string; itemCount?: number; error?: string };
      if (!response.ok || !result.ragRevision) throw new Error(result.error ?? "World RAG refresh failed.");
      const refreshedAt = new Date().toISOString();
      let nextBoard = {
        ...board,
        entities: board.entities.map(entity => entity.category === "unit"
          ? { ...entity, notes: replaceKnowledgeRevision(entity.notes, result.ragRevision!, refreshedAt) }
          : entity),
        timelineEvents: [...board.timelineEvents, {
          id: `rag-refresh-${board.simulation?.turn ?? 0}-${result.ragRevision.slice(0, 12)}`,
          phaseId: board.currentPhaseId,
          label: "Update the world",
          description: `${result.itemCount ?? 0} RAG items indexed. NPC knowledge revision set to ${result.ragRevision.slice(0, 12)}; role-specific retrieval occurs on next update.`,
          severity: "info" as const,
          createdAt: refreshedAt,
          sourceStatus: "verified" as const,
        }],
      };
      if (nextBoard.simulation?.syndicateWorld) {
        const npcIds = nextBoard.entities.filter(entity => entity.category === "unit").map(entity => entity.id);
        nextBoard = {
          ...nextBoard,
          simulation: {
            ...nextBoard.simulation,
            syndicateWorld: applySyndicateCommand(nextBoard.simulation.syndicateWorld, {
              type: "update_world_from_rag",
              commandId: `rag-refresh-${nextBoard.simulation.syndicateWorld.tick}-${result.ragRevision.slice(0, 12)}`,
              tick: nextBoard.simulation.syndicateWorld.tick,
              ragRevision: result.ragRevision,
              npcIds,
            }),
          },
        };
      }
      loadBoard(nextBoard, scenarioId, scenarioName, scenarioDescription);
      toast({ title: "World updated", description: `${result.itemCount ?? 0} RAG items · ${nextBoard.entities.filter(entity => entity.category === "unit").length} NPCs marked for fresh retrieval.` });
    } catch (error) {
      toast({ title: "World update failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setNetworkBusy(false);
    }
  };

  const downloadEmployeeBrief = () => {
    const dynamics = board.simulation?.teamDynamics;
    const syndicates = board.simulation?.syndicateWorld?.syndicates ?? [];
    const content = [
      `# ${scenarioName} — Employee Gameplay Brief`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `Turn: ${board.simulation?.turn ?? 0}`,
      `World: ${board.world ? `${board.world.city}, ${board.world.country}` : "not configured"}`,
      "",
      "## Account status",
      `- Karma: ${dynamics?.userProfile.karma.toFixed(1) ?? "n/a"}`,
      `- Morals: ${dynamics?.userProfile.currentSpectrum.toFixed(1) ?? "n/a"}/100`,
      `- Risk: ${dynamics?.userProfile.riskIndex.toFixed(1) ?? "n/a"}`,
      "",
      "## Factions",
      ...board.simulation?.factions.map(faction => `- ${faction.name}: personnel ${faction.personnel}, cohesion ${faction.cohesion}, legitimacy ${faction.legitimacy}`) ?? [],
      "",
      "## Syndicates",
      ...syndicates.map(syndicate => employeeSyndicateSummary(syndicate)),
      "",
      "## Current phase",
      board.phases.find(phase => phase.id === board.currentPhaseId)?.description ?? "No active phase.",
      "",
      "This document contains fictional, shareable gameplay information only. Hidden intelligence, private RAG documents, credentials and protected data are excluded.",
    ].join("\n");
    downloadText(`${slug(scenarioName)}-employee-brief.md`, content);
  };

  const duplicateProfile = () => {
    if (!activeProfile) return;
    const copy = createAiProfile(activeProfile);
    setProfiles(current => [...current, copy]);
    setActiveProfileId(copy.id);
  };

  const exportProfile = () => {
    if (!activeProfile) return;
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeProfile.id}.ai-profile.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (file: File) => {
    try {
      const profile = JSON.parse(await file.text()) as AiWorkspaceProfile;
      if (!profile.id || !profile.name || !profile.systemPrompt || !profile.routing) throw new Error("Invalid profile");
      const unique = { ...profile, id: `${profile.id}-${Math.random().toString(36).slice(2, 6)}` };
      setProfiles(current => [...current, unique]);
      setActiveProfileId(unique.id);
    } catch {
      setMessages(current => [...current, { role: "assistant", content: "[ERROR: The imported AI profile is invalid.]", mode: workspaceState.chatMode }]);
    }
  };

  return (
    <div className={`flex h-full w-full select-text flex-col border-l transition-colors ${isRedTeam ? "border-destructive bg-destructive/5" : "border-border bg-sidebar"}`}>
      <div className={`flex flex-col gap-2 border-b px-3 py-2 ${isRedTeam ? "border-destructive/30 bg-destructive/10" : "border-border bg-sidebar-primary/5"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {isRedTeam ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <Bot className="h-4 w-4 text-primary" />}
            AI Workspace
            <Badge variant="outline" className="text-[8px]">{activeModeMeta.label}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {isRedTeam && <Badge variant="destructive" className="text-[9px]">RED TEAM GAME MODE</Badge>}
            <Button title="Update the world" variant="ghost" size="icon" className="h-7 w-7" disabled={networkBusy} onClick={() => void updateWorld()}><RefreshCw className={`h-3.5 w-3.5 ${networkBusy ? "animate-spin" : ""}`} /></Button>
            <Button title="Download employee brief" variant="ghost" size="icon" className="h-7 w-7" onClick={downloadEmployeeBrief}><Download className="h-3.5 w-3.5" /></Button>
            <Button title="Copy entire conversation" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void copyConversation()}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowWorkspace(current => !current)}><Settings2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <StatusMeter label="Karma" value={meters.karma} display={meters.karmaDisplay} icon={Scale} />
          <StatusMeter label="Action" value={meters.action} display={meters.action.toFixed(0)} icon={Activity} />
          <StatusMeter label="Health" value={meters.health} display={meters.health.toFixed(0)} icon={HeartPulse} />
          <StatusMeter label="Morals" value={meters.morals} display={meters.morals.toFixed(0)} icon={GlobeLock} />
        </div>

        <div className="grid grid-cols-3 gap-1">
          {CHAT_MODES.map(mode => {
            const Icon = mode.icon;
            return <Button key={mode.id} title={mode.description} size="sm" variant={workspaceState.chatMode === mode.id ? "default" : "outline"} className="h-8 text-[10px] shadow-sm" onClick={() => setChatMode(mode.id)}><Icon className="mr-1 h-3 w-3" />{mode.label}</Button>;
          })}
        </div>

        <div className="rounded-lg border bg-[linear-gradient(135deg,hsl(var(--primary)/0.1),hsl(var(--background)/0.7))] p-2 shadow-inner">
          <div className="flex items-center justify-between gap-2 text-[9px]"><span>LLM moral stance · 1 evil → 100 good</span><strong>{workspaceState.llmMoralSpectrum}/100</strong></div>
          <input aria-label="LLM moral stance" type="range" min="1" max="100" value={workspaceState.llmMoralSpectrum} onChange={event => updateWorkspace(current => ({ ...current, llmMoralSpectrum: Number(event.target.value) }))} className="mt-1 w-full accent-primary" />
        </div>

        <Button size="sm" className="h-8 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.75))] text-[10px] shadow-lg shadow-primary/15" disabled={storylineBusy || sendMessageMutation.isPending} onClick={() => void runStorylineWorkflow()}>
          <Sparkles className={`mr-1 h-3.5 w-3.5 ${storylineBusy ? "animate-pulse" : ""}`} />
          {storylineBusy ? "Running Talk → Plan → Build…" : "Create Storyline"}
        </Button>

        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant={networkMode === "ask_first" ? "default" : "outline"} className="h-7 text-[10px]" disabled={networkBusy} onClick={() => void changeNetworkMode("ask_first")}><GlobeLock className="mr-1 h-3 w-3" />Ask First</Button>
          <Button size="sm" variant={networkMode === "ultra" ? "default" : "outline"} className="h-7 text-[10px]" disabled={networkBusy} onClick={() => void changeNetworkMode("ultra")}><Activity className="mr-1 h-3 w-3" />Ultra</Button>
        </div>

        <Select value={activeProfileId} onValueChange={setActiveProfileId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="AI profile" /></SelectTrigger><SelectContent>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id} className="text-xs">{profile.name}</SelectItem>)}</SelectContent></Select>
        <Select value={selectedRole} onValueChange={value => setSelectedRole(value as AdvisorRole)}><SelectTrigger className={`h-8 text-xs ${isRedTeam ? "border-destructive/50" : ""}`}><SelectValue placeholder="Select Role" /></SelectTrigger><SelectContent>{ADVISOR_ROLES.map(role => <SelectItem key={role.id} value={role.id} className="text-xs">{role.name}</SelectItem>)}</SelectContent></Select>
        <div className="text-[10px] italic leading-tight text-muted-foreground">{activeProfile?.description || roleMeta?.tagline}</div>

        {showWorkspace && activeProfile && <div className="space-y-2 rounded-md border border-border bg-background/60 p-2 shadow-inner">
          <div className="grid grid-cols-3 gap-1">{(["rotate", "static", "off"] as const).map(mode => <Button key={mode} variant={activeProfile.routing.mode === mode ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => updateActiveProfile(profile => ({ ...profile, routing: { ...profile.routing, mode } }))}>{mode}</Button>)}</div>
          <Input className="h-8 text-[10px]" value={activeProfile.name} onChange={event => updateActiveProfile(profile => ({ ...profile, name: event.target.value }))} />
          <Textarea className="min-h-20 text-[10px]" value={activeProfile.systemPrompt} onChange={event => updateActiveProfile(profile => ({ ...profile, systemPrompt: event.target.value }))} />
          <Textarea className="min-h-16 text-[10px]" value={activeProfile.rules.join("\n")} onChange={event => updateActiveProfile(profile => ({ ...profile, rules: event.target.value.split("\n").filter(Boolean) }))} placeholder="One rule per line" />
          <Textarea className="min-h-12 text-[10px]" value={activeProfile.skills.join(", ")} onChange={event => updateActiveProfile(profile => ({ ...profile, skills: event.target.value.split(",").map(value => value.trim()).filter(Boolean) }))} placeholder="Skills" />
          <div className="flex flex-wrap gap-1">{activeProfile.mcpServers.map(server => <Button key={server.id} variant={server.enabled ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => updateActiveProfile(profile => ({ ...profile, mcpServers: profile.mcpServers.map(item => item.id === server.id ? { ...item, enabled: !item.enabled } : item) }))}>{server.name}</Button>)}</div>

          <div className="space-y-2 rounded border p-2">
            <div className="flex items-center gap-1 text-[10px] font-medium"><BookOpen className="h-3.5 w-3.5" />Account RAG imports</div>
            <div><Label className="text-[9px]">Account name</Label><Input className="h-7 text-[10px]" value={accountName} onChange={event => setAccountName(event.target.value)} /></div>
            <Button variant="outline" size="sm" className="h-7 w-full text-[10px]" disabled={networkBusy || !networkSession} onClick={() => void importArtOfWar()}><BookOpen className="mr-1 h-3 w-3" />Import public-domain Art of War</Button>
            <div className="grid grid-cols-2 gap-1"><div><Label className="text-[9px]">Hugging Face repo</Label><Input className="h-7 text-[10px]" value={hfRepoId} onChange={event => setHfRepoId(event.target.value)} placeholder="owner/repo" /></div><div><Label className="text-[9px]">Revision</Label><Input className="h-7 text-[10px]" value={hfRevision} onChange={event => setHfRevision(event.target.value)} /></div></div>
            <Textarea className="min-h-12 text-[10px]" value={hfFiles} onChange={event => setHfFiles(event.target.value)} placeholder="README.md, docs/file.txt" />
            <Button variant="outline" size="sm" className="h-7 w-full text-[10px]" disabled={networkBusy || !networkSession || !hfRepoId.trim()} onClick={() => void importHuggingFace()}><CloudDownload className="mr-1 h-3 w-3" />Pull selected text into RAG</Button>
            <p className="text-[9px] text-muted-foreground">Text only. No weights, pickle files, executables or remote code are downloaded or run.</p>
          </div>

          <div className="flex gap-1"><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={duplicateProfile}><Copy className="mr-1 h-3 w-3" />Duplicate</Button><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={exportProfile}><Download className="mr-1 h-3 w-3" />Export</Button><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={() => importRef.current?.click()}><Upload className="mr-1 h-3 w-3" />Import</Button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importProfile(file); }} /></div>
        </div>}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => <div key={index} className={`group flex gap-2 text-sm ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isRedTeam ? "border border-destructive/50 bg-destructive/20 text-destructive" : "border border-primary/30 bg-primary/20 text-primary"}`}>{isRedTeam ? <ShieldAlert className="h-3 w-3" /> : <Bot className="h-3 w-3" />}</div>}
            <div className="relative max-w-[85%]">
              <div className={`rounded-lg p-3 shadow-sm ${message.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : `rounded-tl-sm ${isRedTeam ? "border border-destructive/20 bg-destructive/10" : "border border-border bg-muted"}`}`}>
                {message.mode && <div className="mb-1 text-[8px] font-semibold uppercase tracking-wider opacity-70">{message.mode}</div>}
                <div className="cursor-text whitespace-pre-wrap text-xs leading-relaxed select-text">{message.content}</div>
              </div>
              <Button title="Copy message" variant="secondary" size="icon" className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => void copyText(message.content, index)}>{copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</Button>
            </div>
          </div>)}
        </div>
      </ScrollArea>

      <div className={`border-t p-3 ${isRedTeam ? "border-destructive/30 bg-destructive/5" : "border-border bg-sidebar-primary/5"}`}>
        {pendingBuild && <div className="mb-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 shadow-inner">
          <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-semibold">Validated additive build proposal detected</div><p className="text-[9px] text-muted-foreground">Nothing changes until Apply is pressed.</p></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingBuild(null)}><X className="h-3 w-3" /></Button></div>
          <Button className="mt-2 h-7 w-full text-[10px]" onClick={applyPendingBuild}><Check className="mr-1 h-3 w-3" />Apply build proposal</Button>
        </div>}
        <div className="mb-1 flex flex-wrap gap-1"><Button title="Paste clipboard" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => void pasteClipboard()}><ClipboardPaste className="mr-1 h-3 w-3" />Paste</Button><Button title="Select all input text" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={selectInput}><TextSelect className="mr-1 h-3 w-3" />Select all</Button><Button title="Copy conversation" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => void copyConversation()}><Copy className="mr-1 h-3 w-3" />Copy all</Button></div>
        <div className="relative"><Textarea ref={inputRef} className={`min-h-[72px] resize-y pr-10 text-xs select-text ${isRedTeam ? "border-destructive/50 focus-visible:ring-destructive" : ""}`} placeholder={`${activeModeMeta.label} with ${activeProfile?.name ?? roleMeta?.name}…`} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} /><Button size="icon" className={`absolute bottom-2 right-2 h-6 w-6 ${isRedTeam ? "bg-destructive hover:bg-destructive/90" : ""}`} onClick={() => void handleSend()} disabled={!input.trim() || sendMessageMutation.isPending || storylineBusy}><Send className="h-3 w-3" /></Button></div>
      </div>
    </div>
  );
}

function StatusMeter({ label, value, display, icon: Icon }: { label: string; value: number; display: string; icon: typeof Activity }) {
  const normalized = Math.max(0, Math.min(100, value));
  return <div className="rounded border bg-[linear-gradient(145deg,hsl(var(--background)/0.9),hsl(var(--muted)/0.45))] p-1 shadow-inner"><div className="flex items-center justify-between gap-1 text-[8px]"><span className="flex items-center gap-0.5 text-muted-foreground"><Icon className="h-2.5 w-2.5" />{label}</span><strong>{display}</strong></div><div className="mt-1 h-1 overflow-hidden rounded bg-muted shadow-inner"><div className="h-full rounded bg-[linear-gradient(90deg,hsl(var(--primary)/0.7),hsl(var(--primary)))] transition-[width]" style={{ width: `${normalized}%` }} /></div></div>;
}

function calculateMeters(board: ReturnType<typeof useBoardStore.getState>["board"]) {
  const profile = board.simulation?.teamDynamics?.userProfile;
  const side = profile?.side === "blue" ? "police" : profile?.side === "red" ? "criminal" : undefined;
  const units = board.entities.filter(entity => entity.category === "unit" && (!side || entity.faction === side));
  const health = units.length > 0
    ? units.reduce((sum, entity) => sum + (entity.attributes.readiness + entity.attributes.morale) / 2, 0) / units.length
    : 50;
  const actionPulse = profile?.side === "blue"
    ? board.simulation?.teamDynamics?.blue.estimatedSuccess
    : profile?.side === "red"
      ? board.simulation?.teamDynamics?.red.estimatedSuccess
      : ((board.simulation?.teamDynamics?.red.estimatedSuccess ?? 50) + (board.simulation?.teamDynamics?.blue.estimatedSuccess ?? 50)) / 2;
  const karmaRaw = profile?.karma ?? 0;
  return {
    karma: Math.max(0, Math.min(100, 50 + karmaRaw / 2)),
    karmaDisplay: `${karmaRaw >= 0 ? "+" : ""}${karmaRaw.toFixed(0)}`,
    action: Math.max(0, Math.min(100, actionPulse ?? 50)),
    health: Math.max(0, Math.min(100, health)),
    morals: Math.max(1, Math.min(100, profile?.currentSpectrum ?? 50)),
  };
}

async function createNetworkSession(mode: NetworkMode): Promise<NetworkSession> {
  const response = await fetch("/api/network/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ttlMinutes: 120 }),
  });
  const body = await response.json() as { session?: { id: string; mode: NetworkMode; expiresAt: string }; token?: string; error?: string };
  if (!response.ok || !body.session || !body.token) throw new Error(body.error ?? "Network session creation failed.");
  return { id: body.session.id, mode: body.session.mode, expiresAt: body.session.expiresAt, token: body.token };
}

async function fetchWithApprovals(endpoint: string, payload: unknown, session: NetworkSession, mode: NetworkMode): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Network-Session-Id": session.id,
        "X-Network-Session-Token": session.token,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as Record<string, unknown> & { error?: string; code?: string; approval?: PendingApproval };
    if (response.ok) return body;
    if (response.status !== 409 || body.code !== "network_approval_required" || !body.approval) throw new Error(body.error ?? `Request failed with HTTP ${response.status}.`);
    if (mode === "ultra") throw new Error("Ultra session unexpectedly requested approval; the request was blocked.");
    const approval = body.approval;
    const approved = window.confirm(`Allow this one external request?\n\nCapability: ${approval.capability}\nTarget: ${approval.targetOrigin}${approval.targetPath}\nReason: ${approval.reason}\n\nThe approval expires and is consumed after one matching request.`);
    const decisionResponse = await fetch(`/api/network/sessions/${encodeURIComponent(session.id)}/approvals/${encodeURIComponent(approval.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Network-Session-Token": session.token },
      body: JSON.stringify({ decision: approved ? "approved" : "denied" }),
    });
    if (!decisionResponse.ok || !approved) throw new Error(approved ? "Network approval could not be recorded." : "Network request denied by user.");
  }
  throw new Error("Network import required too many redirects or approvals.");
}

function replaceKnowledgeRevision(notes: string, revision: string, refreshedAt: string): string {
  const withoutPrevious = notes.replace(/\n?Knowledge revision: [^\n]+/g, "").replace(/\n?Knowledge refreshed: [^\n]+/g, "").trim();
  return `${withoutPrevious}${withoutPrevious ? "\n" : ""}Knowledge revision: ${revision}\nKnowledge refreshed: ${refreshedAt}`;
}

function employeeSyndicateSummary(syndicate: Syndicate): string {
  return `- ${syndicate.name}: ${syndicate.memberIds.length} members, ${syndicate.controlledTerritoryIds.length} territories, strategy ${syndicate.activeStrategy}, stability ${syndicate.power.organizationalStability.toFixed(1)}, legitimacy ${syndicate.power.publicLegitimacy.toFixed(1)}`;
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "brief";
}
