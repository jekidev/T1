import { useState, useRef, useEffect } from "react";
import { useBoardStore, ADVISOR_ROLES, AdvisorRole } from "@/lib/game";
import { useSendAdvisorMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Send, ShieldAlert, Copy, Download, Upload, Settings2, ClipboardPaste, Check, TextSelect } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LLM_MODE_META, useLlmMode } from "@/lib/llm-mode";
import {
  buildAiProfileContext,
  createAiProfile,
  loadActiveAiProfileId,
  loadAiProfiles,
  saveActiveAiProfileId,
  saveAiProfiles,
  type AiWorkspaceProfile,
} from "@/lib/ai-workspace";

interface Message { role: "user" | "assistant"; content: string; }

export function AdvisorPanel() {
  const board = useBoardStore(s => s.board);
  const [llmMode] = useLlmMode();
  const [selectedRole, setSelectedRole] = useState<AdvisorRole>("neutral_analyst");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "AI Advisor initialized. Select a profile and role, then play or develop the game together with AI." }]);
  const [input, setInput] = useState("");
  const [profiles, setProfiles] = useState<AiWorkspaceProfile[]>(() => loadAiProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => loadActiveAiProfileId());
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const sendMessageMutation = useSendAdvisorMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const roleMeta = ADVISOR_ROLES.find(r => r.id === selectedRole);
  const isRedTeam = selectedRole === "red_team_risk_model";
  const activeProfile = profiles.find(profile => profile.id === activeProfileId) ?? profiles[0];

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, sendMessageMutation.isPending]);
  useEffect(() => { saveAiProfiles(profiles); }, [profiles]);
  useEffect(() => { saveActiveAiProfileId(activeProfileId); }, [activeProfileId]);

  const updateActiveProfile = (update: (profile: AiWorkspaceProfile) => AiWorkspaceProfile) => setProfiles(current => current.map(profile => profile.id === activeProfileId ? update(profile) : profile));

  const copyText = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (typeof index === "number") { setCopiedIndex(index); setTimeout(() => setCopiedIndex(null), 1200); }
      toast({ title: "Copied to clipboard" });
    } catch { toast({ title: "Clipboard access failed", variant: "destructive" }); }
  };

  const copyConversation = () => copyText(messages.map(m => `${m.role === "user" ? "YOU" : "AI"}:\n${m.content}`).join("\n\n---\n\n"));
  const pasteClipboard = async () => {
    try { const text = await navigator.clipboard.readText(); setInput(current => current ? `${current}\n${text}` : text); inputRef.current?.focus(); }
    catch { toast({ title: "Clipboard read permission was not granted", variant: "destructive" }); }
  };
  const selectInput = () => { inputRef.current?.focus(); inputRef.current?.select(); };

  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending || !activeProfile) return;
    const userMsg = input.trim(); setInput(""); setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    try {
      const response = await sendMessageMutation.mutateAsync({ data: { role: selectedRole, message: `${buildAiProfileContext(activeProfile)}\n\n${LLM_MODE_META[llmMode].advisorInstruction}\n\nCurrent user request:\n${userMsg}`, board: board as any, history: messages.map(m => ({ role: m.role, content: m.content })) } });
      setMessages(prev => [...prev, { role: "assistant", content: response.reply }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "[ERROR: Communication with advisor failed. Check API connection.]" }]); }
  };

  const duplicateProfile = () => { if (!activeProfile) return; const copy = createAiProfile(activeProfile); setProfiles(current => [...current, copy]); setActiveProfileId(copy.id); };
  const exportProfile = () => { if (!activeProfile) return; const blob = new Blob([JSON.stringify(activeProfile, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${activeProfile.id}.ai-profile.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };
  const importProfile = async (file: File) => { try { const profile = JSON.parse(await file.text()) as AiWorkspaceProfile; if (!profile.id || !profile.name || !profile.systemPrompt || !profile.routing) throw new Error("Invalid profile"); const unique = { ...profile, id: `${profile.id}-${Math.random().toString(36).slice(2, 6)}` }; setProfiles(current => [...current, unique]); setActiveProfileId(unique.id); } catch { setMessages(prev => [...prev, { role: "assistant", content: "[ERROR: The imported AI profile is invalid.]" }]); } };

  return (
    <div className={`w-full h-full flex flex-col border-l transition-colors select-text ${isRedTeam ? "border-destructive bg-destructive/5" : "border-border bg-sidebar"}`}>
      <div className={`px-4 py-3 border-b flex flex-col gap-2 ${isRedTeam ? "border-destructive/30 bg-destructive/10" : "border-border bg-sidebar-primary/5"}`}>
        <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-sm font-semibold">{isRedTeam ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <Bot className="h-4 w-4 text-primary" />}AI Workspace <Badge variant="outline" className="text-[9px]">{LLM_MODE_META[llmMode].label}</Badge></div><div className="flex items-center gap-1">{isRedTeam && <Badge variant="destructive" className="text-[10px]">RED TEAM GAME MODE</Badge>}<Button title="Copy entire conversation" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void copyConversation()}><Copy className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowWorkspace(current => !current)}><Settings2 className="h-3.5 w-3.5" /></Button></div></div>
        <Select value={activeProfileId} onValueChange={setActiveProfileId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="AI profile" /></SelectTrigger><SelectContent>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id} className="text-xs">{profile.name}</SelectItem>)}</SelectContent></Select>
        <Select value={selectedRole} onValueChange={val => setSelectedRole(val as AdvisorRole)}><SelectTrigger className={`h-8 text-xs ${isRedTeam ? "border-destructive/50" : ""}`}><SelectValue placeholder="Select Role" /></SelectTrigger><SelectContent>{ADVISOR_ROLES.map(role => <SelectItem key={role.id} value={role.id} className="text-xs">{role.name}</SelectItem>)}</SelectContent></Select>
        <div className="text-[10px] text-muted-foreground italic leading-tight">{activeProfile?.description || roleMeta?.tagline} · {LLM_MODE_META[llmMode].short}</div>
        {showWorkspace && activeProfile && <div className="space-y-2 rounded-md border border-border bg-background/60 p-2"><div className="grid grid-cols-3 gap-1">{(["rotate", "static", "off"] as const).map(mode => <Button key={mode} variant={activeProfile.routing.mode === mode ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => updateActiveProfile(profile => ({ ...profile, routing: { ...profile.routing, mode } }))}>{mode}</Button>)}</div><input className="w-full rounded border border-input bg-background px-2 py-1 text-[10px]" value={activeProfile.name} onChange={event => updateActiveProfile(profile => ({ ...profile, name: event.target.value }))} /><Textarea className="min-h-20 text-[10px]" value={activeProfile.systemPrompt} onChange={event => updateActiveProfile(profile => ({ ...profile, systemPrompt: event.target.value }))} /><Textarea className="min-h-16 text-[10px]" value={activeProfile.rules.join("\n")} onChange={event => updateActiveProfile(profile => ({ ...profile, rules: event.target.value.split("\n").filter(Boolean) }))} placeholder="One rule per line" /><Textarea className="min-h-12 text-[10px]" value={activeProfile.skills.join(", ")} onChange={event => updateActiveProfile(profile => ({ ...profile, skills: event.target.value.split(",").map(value => value.trim()).filter(Boolean) }))} placeholder="Skills" /><div className="flex flex-wrap gap-1">{activeProfile.mcpServers.map(server => <Button key={server.id} variant={server.enabled ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => updateActiveProfile(profile => ({ ...profile, mcpServers: profile.mcpServers.map(item => item.id === server.id ? { ...item, enabled: !item.enabled } : item) }))}>{server.name}</Button>)}</div><div className="flex gap-1"><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={duplicateProfile}><Copy className="mr-1 h-3 w-3" />Duplicate</Button><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={exportProfile}><Download className="mr-1 h-3 w-3" />Export</Button><Button variant="outline" size="sm" className="h-7 flex-1 text-[10px]" onClick={() => importRef.current?.click()}><Upload className="mr-1 h-3 w-3" />Import</Button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importProfile(file); }} /></div></div>}
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}><div className="space-y-4">{messages.map((m, i) => <div key={i} className={`group flex gap-2 text-sm ${m.role === "user" ? "justify-end" : "justify-start"}`}>{m.role === "assistant" && <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isRedTeam ? "bg-destructive/20 text-destructive border border-destructive/50" : "bg-primary/20 text-primary border border-primary/30"}`}>{isRedTeam ? <ShieldAlert className="w-3 h-3" /> : <Bot className="w-3 h-3" />}</div>}<div className="relative max-w-[85%]"><div className={`rounded-lg p-3 select-text cursor-text ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : `rounded-tl-sm ${isRedTeam ? "bg-destructive/10 border border-destructive/20" : "bg-muted border border-border"}`}`}><div className="whitespace-pre-wrap text-xs leading-relaxed select-text">{m.content}</div></div><Button title="Copy message" variant="secondary" size="icon" className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => void copyText(m.content, i)}>{copiedIndex === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</Button></div></div>)}</div></ScrollArea>

      <div className={`p-3 border-t ${isRedTeam ? "border-destructive/30 bg-destructive/5" : "border-border bg-sidebar-primary/5"}`}><div className="mb-1 flex gap-1"><Button title="Paste clipboard" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => void pasteClipboard()}><ClipboardPaste className="mr-1 h-3 w-3" />Paste</Button><Button title="Select all input text" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={selectInput}><TextSelect className="mr-1 h-3 w-3" />Select all</Button><Button title="Copy conversation" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => void copyConversation()}><Copy className="mr-1 h-3 w-3" />Copy all</Button></div><div className="relative"><Textarea ref={inputRef} className={`min-h-[72px] text-xs resize-y pr-10 select-text ${isRedTeam ? "border-destructive/50 focus-visible:ring-destructive" : ""}`} placeholder={`Play or build with ${activeProfile?.name ?? roleMeta?.name}...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }} /><Button size="icon" className={`absolute right-2 bottom-2 h-6 w-6 ${isRedTeam ? "bg-destructive hover:bg-destructive/90" : ""}`} onClick={() => void handleSend()} disabled={!input.trim() || sendMessageMutation.isPending}><Send className="h-3 w-3" /></Button></div></div>
    </div>
  );
}
