import { useState, useRef, useEffect } from "react";
import { useBoardStore, ADVISOR_ROLES, AdvisorRole } from "@/lib/game";
import { useSendAdvisorMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Send, User, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AdvisorPanel() {
  const board = useBoardStore(s => s.board);
  const [selectedRole, setSelectedRole] = useState<AdvisorRole>("neutral_analyst");
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "AI Advisor initialized. Select a role and ask for an assessment of the current board." }
  ]);
  const [input, setInput] = useState("");
  
  const sendMessageMutation = useSendAdvisorMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const roleMeta = ADVISOR_ROLES.find(r => r.id === selectedRole);
  const isRedTeam = selectedRole === "red_team_risk_model";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessageMutation.isPending]);

  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    try {
      const response = await sendMessageMutation.mutateAsync({
        data: {
          role: selectedRole,
          message: userMsg,
          board: board as any,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "[ERROR: Communication with advisor failed. Check API connection.]" }]);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col border-l transition-colors ${isRedTeam ? 'border-destructive bg-destructive/5' : 'border-border bg-sidebar'}`}>
      <div className={`px-4 py-3 border-b flex flex-col gap-2 ${isRedTeam ? 'border-destructive/30 bg-destructive/10' : 'border-border bg-sidebar-primary/5'}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {isRedTeam ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <Bot className="h-4 w-4 text-primary" />}
            AI Advisor
          </div>
          {isRedTeam && <Badge variant="destructive" className="text-[10px]">DEFENSIVE ANALYSIS ONLY</Badge>}
        </div>
        <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as AdvisorRole)}>
          <SelectTrigger className={`h-8 text-xs ${isRedTeam ? 'border-destructive/50' : ''}`}>
            <SelectValue placeholder="Select Role" />
          </SelectTrigger>
          <SelectContent>
            {ADVISOR_ROLES.map(role => (
              <SelectItem key={role.id} value={role.id} className="text-xs">
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[10px] text-muted-foreground italic leading-tight">
          {roleMeta?.tagline}
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 text-sm ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isRedTeam ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                  {isRedTeam ? <ShieldAlert className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg p-3 ${
                m.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : `rounded-tl-sm ${isRedTeam ? 'bg-destructive/10 border border-destructive/20 text-foreground' : 'bg-muted border border-border text-foreground'}`
              }`}>
                <div className="whitespace-pre-wrap text-xs leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          {sendMessageMutation.isPending && (
            <div className="flex gap-3 text-sm justify-start">
               <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isRedTeam ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                  {isRedTeam ? <ShieldAlert className="w-3 h-3" /> : <Bot className="w-3 h-3 animate-pulse" />}
                </div>
                <div className={`max-w-[85%] rounded-lg p-3 rounded-tl-sm animate-pulse ${isRedTeam ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted border border-border'}`}>
                  <div className="h-2 w-12 bg-foreground/20 rounded mb-2"></div>
                  <div className="h-2 w-24 bg-foreground/20 rounded"></div>
                </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className={`p-3 border-t ${isRedTeam ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-sidebar-primary/5'}`}>
        <div className="relative">
          <Textarea 
            className={`min-h-[60px] text-xs resize-none pr-10 ${isRedTeam ? 'border-destructive/50 focus-visible:ring-destructive' : ''}`}
            placeholder={`Ask ${roleMeta?.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            size="icon" 
            className={`absolute right-2 bottom-2 h-6 w-6 ${isRedTeam ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={handleSend}
            disabled={!input.trim() || sendMessageMutation.isPending}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}