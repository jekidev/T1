import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import type { BoardState } from "@/lib/game";
import { DEFAULT_ATTRIBUTES } from "@/lib/game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Network, Search, UserPlus, UserRound, Users, X } from "lucide-react";

interface TelegramPerson { id: string; displayName: string; username?: string; biography?: string; avatarUrl?: string; }

export function FamilyTreePanel({ open, board, onClose, onChange }: { open: boolean; board: BoardState; onClose: () => void; onChange: (board: BoardState) => void }) {
  const world = board.simulation?.syndicateWorld;
  const [selectedId, setSelectedId] = useState(world?.syndicates[0]?.id ?? "");
  const [telegramQuery, setTelegramQuery] = useState("");
  const [telegramPeople, setTelegramPeople] = useState<TelegramPerson[]>([]);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const selected = world?.syndicates.find(item => item.id === selectedId) ?? world?.syndicates[0];
  const entityById = useMemo(() => new Map(board.entities.map(entity => [entity.id, entity])), [board.entities]);

  if (!open) return null;

  const scanTelegram = async () => {
    setTelegramBusy(true);
    try {
      const response = await fetch(`/api/telegram/people?query=${encodeURIComponent(telegramQuery)}&limit=40`);
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(extractMessage(body));
      setTelegramPeople(normalizePeople(body));
    } catch (error) {
      setTelegramPeople([{ id: "error", displayName: error instanceof Error ? error.message : String(error), biography: "Configure TELEGRAM_AUTH_API_URL and authenticate Telegram before scanning." }]);
    } finally {
      setTelegramBusy(false);
    }
  };

  const addTelegramUnit = (person: TelegramPerson) => {
    if (person.id === "error") return;
    const id = `telegram-unit-${nanoid(10)}`;
    const index = board.entities.length;
    onChange({
      ...board,
      entities: [...board.entities, {
        id,
        templateId: "unit-civilian",
        category: "unit",
        faction: "neutral",
        label: person.displayName,
        x: 140 + (index * 91) % 720,
        y: 140 + (index * 137) % 720,
        rotation: 0,
        scale: 1,
        zIndex: index,
        layerId: board.layers[0]?.id ?? "layer-default",
        zoneId: null,
        groupId: null,
        locked: false,
        attributes: { ...DEFAULT_ATTRIBUTES, influence: 20, intelligence: 20 },
        notes: `Imported from an explicitly selected Telegram MCP result.${person.username ? ` Username: @${person.username}` : ""}`,
        profile: {
          personality: "Not yet defined. Build personality through dialogue, player notes and gameplay events.",
          biography: person.biography ?? "Imported as a fictionalizable board contact from Telegram MCP.",
          traits: ["telegram-contact", "unassigned"],
          source: "telegram_mcp",
          ...(person.avatarUrl ? { avatarUrl: person.avatarUrl } : {}),
        },
        sourceStatus: "unverified",
      }],
      timelineEvents: [...board.timelineEvents, {
        id: `telegram-import-${nanoid(8)}`,
        phaseId: board.currentPhaseId,
        label: "Telegram contact added",
        description: `${person.displayName} was explicitly selected and added as an unassigned neutral unit. No group or contact was imported automatically.`,
        severity: "info",
        createdAt: new Date().toISOString(),
        sourceStatus: "unverified",
      }],
    });
  };

  const rankedRoles = selected ? [...selected.hierarchy].sort((a, b) => b.successionPriority - a.successionPriority) : [];
  const factionAssets = board.entities.filter(entity => ["location", "resource", "vehicle"].includes(entity.category) && entity.faction === "criminal");

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md">
      <div className="flex h-full flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card/90 px-4 shadow-lg"><div><h2 className="flex items-center gap-2 font-semibold"><Network className="h-4 w-4" />Family Tree</h2><p className="text-[10px] text-muted-foreground">Italian-mafia-inspired rank visualization adapted to the fictional Danish syndicate model.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4 overflow-auto border-r bg-card/60 p-4 shadow-inner">
            <div><div className="mb-2 text-xs font-semibold">Syndicate</div><Select value={selected?.id ?? ""} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Select syndicate" /></SelectTrigger><SelectContent>{world?.syndicates.map(syndicate => <SelectItem key={syndicate.id} value={syndicate.id}>{syndicate.name}</SelectItem>)}</SelectContent></Select></div>
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs"><Search className="h-3.5 w-3.5" />Telegram MCP people</CardTitle></CardHeader><CardContent className="space-y-2"><Input value={telegramQuery} onChange={event => setTelegramQuery(event.target.value)} placeholder="Name, username or keyword" /><Button className="w-full" variant="outline" disabled={telegramBusy} onClick={() => void scanTelegram()}><Search className="mr-2 h-4 w-4" />{telegramBusy ? "Scanning…" : "Scan configured Telegram service"}</Button><div className="space-y-2">{telegramPeople.map(person => <div key={person.id} className="rounded border bg-background/70 p-2 shadow-inner"><div className="flex items-start gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">{person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{person.displayName}</div><div className="truncate text-[9px] text-muted-foreground">{person.username ? `@${person.username}` : person.biography}</div></div>{person.id !== "error" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addTelegramUnit(person)}><UserPlus className="h-3.5 w-3.5" /></Button>}</div></div>)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs"><Building2 className="h-3.5 w-3.5" />Faction assets</CardTitle></CardHeader><CardContent className="space-y-1 text-[10px]">{factionAssets.length === 0 ? <span className="text-muted-foreground">No owned board assets yet.</span> : factionAssets.map(asset => <div key={asset.id} className="rounded border px-2 py-1">{asset.label} · {asset.category}</div>)}</CardContent></Card>
          </aside>

          <main className="overflow-auto p-4 md:p-8">
            {!selected || !world ? <div className="grid h-full place-items-center text-muted-foreground">No syndicate exists yet.</div> : <div className="mx-auto max-w-6xl space-y-5">
              <div className="rounded-xl border bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.15),transparent_55%),hsl(var(--card))] p-5 text-center shadow-2xl"><Badge variant="outline">FOUNDING BOSS</Badge><h3 className="mt-2 text-2xl font-bold">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.memberIds.length} registered members · {selected.resources.capital.toFixed(0)} capital · loyalty {selected.internalLoyalty.toFixed(0)}</p></div>
              <div className="mx-auto h-8 w-px bg-gradient-to-b from-primary to-border" />
              <div className="space-y-6">{rankedRoles.map((role, roleIndex) => { const members = world.memberships.filter(member => member.syndicateId === selected.id && member.roleId === role.id); return <section key={role.id}><div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><Badge className="shadow-md">{role.title} · rank {roleIndex + 1}</Badge><div className="h-px flex-1 bg-border" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{members.length === 0 ? <div className="col-span-full rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Vacant role</div> : members.map(member => { const entity = entityById.get(member.npcId); return <Card key={`${member.npcId}-${role.id}`} className="overflow-hidden border-primary/20 shadow-lg"><CardContent className="flex gap-3 p-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted shadow-inner">{entity?.profile?.avatarUrl ? <img src={entity.profile.avatarUrl} alt={entity.label} className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{entity?.label ?? member.npcId}</div><div className="text-[9px] text-muted-foreground">loyalty {member.loyalty.toFixed(0)} · trust {member.trust.toFixed(0)} · competence {member.competence.toFixed(0)}</div><p className="mt-1 line-clamp-3 text-[10px]">{entity?.profile?.personality ?? role.responsibilities.join(" · ")}</p></div></CardContent></Card>; })}</div></section>; })}</div>
              <div className="rounded-xl border bg-card/80 p-4 shadow-lg"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Unassigned people</div><div className="flex flex-wrap gap-2">{board.entities.filter(entity => entity.category === "unit" && !selected.memberIds.includes(entity.id)).map(entity => <Badge key={entity.id} variant="outline">{entity.label}</Badge>)}</div></div>
            </div>}
          </main>
        </div>
      </div>
    </div>
  );
}

function normalizePeople(body: unknown): TelegramPerson[] {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const source = Array.isArray(body) ? body : Array.isArray(record.people) ? record.people : Array.isArray(record.users) ? record.users : Array.isArray(record.results) ? record.results : [];
  return source.slice(0, 100).map((value, index) => {
    const person = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const first = stringValue(person.first_name) ?? stringValue(person.firstName);
    const last = stringValue(person.last_name) ?? stringValue(person.lastName);
    const username = stringValue(person.username);
    const combinedName = [first, last].filter(Boolean).join(" ");
    const displayName = stringValue(person.displayName) ?? stringValue(person.name) ?? combinedName || username || `Telegram person ${index + 1}`;
    const avatarUrl = stringValue(person.avatarUrl) ?? stringValue(person.photo_url);
    const biography = stringValue(person.bio);
    return {
      id: String(person.id ?? person.user_id ?? `telegram-${index}`),
      displayName,
      ...(username ? { username } : {}),
      ...(biography ? { biography } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  });
}

function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function extractMessage(body: unknown): string { return body && typeof body === "object" && typeof (body as Record<string, unknown>).message === "string" ? String((body as Record<string, unknown>).message) : "Telegram people scan failed."; }
