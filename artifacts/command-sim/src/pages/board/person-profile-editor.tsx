import { useMemo, useState } from "react";
import type { BoardEntity, EntityProfile, PersonPresenceStatus } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CircleDollarSign,
  Clock3,
  ShieldCheck,
  Upload,
  UserRound,
  Wifi,
} from "lucide-react";

interface PersonProfileEditorProps {
  entity: BoardEntity;
  onUpdate: (patch: Partial<BoardEntity>) => void;
}

const DEFAULT_PROFILE: EntityProfile = {
  personality: "",
  biography: "",
  traits: [],
  source: "manual",
  status: "unknown",
  experience: [],
  walletMinor: 0,
  maximumRecordedWalletMinor: 0,
  accent: "#68a7ff",
};

const STATUS_OPTIONS: Array<{ value: PersonPresenceStatus; label: string }> = [
  { value: "online", label: "Online" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
  { value: "unknown", label: "Unknown" },
];

export function PersonProfileEditor({ entity, onUpdate }: PersonProfileEditorProps) {
  const [uploading, setUploading] = useState(false);
  const profile = useMemo(
    () => ({ ...DEFAULT_PROFILE, ...entity.profile }),
    [entity.profile],
  );

  const updateProfile = (patch: Partial<EntityProfile>) => {
    onUpdate({ profile: { ...profile, ...patch } });
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const response = await fetch("/api/asset-generation/sources", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file,
      });
      const body = await response.json() as { source?: { id: string }; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Profile image upload failed.");
      updateProfile({
        avatarAssetId: body.source.id,
        avatarUrl: `/api/asset-generation/sources/${encodeURIComponent(body.source.id)}`,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-[linear-gradient(145deg,hsl(var(--background)/0.9),hsl(var(--muted)/0.38))] p-3 shadow-inner">
      <div className="flex items-start gap-3">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-[inset_0_0_22px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.22)]"
          style={{ borderColor: profile.accent, backgroundColor: `${profile.accent}22` }}
        >
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt={entity.label} className="h-full w-full object-cover" />
            : <UserRound className="h-7 w-7 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{entity.label}</h3>
            <Badge variant="outline" className="text-[9px] uppercase">{profile.source}</Badge>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{profile.role || "Unassigned role"}{profile.username ? ` · ${profile.username}` : ""}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusDot(profile.status)}`} />
            <span className="capitalize">{profile.status}</span>
            <span>·</span>
            <span>{profile.lastSeen || "No activity recorded"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg border bg-border/70 p-px text-[10px]">
        <ProfileStat icon={Wifi} label="Status" value={capitalize(profile.status)} />
        <ProfileStat icon={CircleDollarSign} label="Wallet" value={formatDkk(profile.walletMinor)} />
        <ProfileStat icon={ShieldCheck} label="Peak" value={formatDkk(profile.maximumRecordedWalletMinor)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border bg-background/65 px-2 py-1.5 text-[10px] shadow-sm hover:bg-accent">
          <Upload className="mr-1 h-3 w-3" />
          {uploading ? "Uploading…" : "Profile image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="inline-flex items-center gap-2 rounded-md border bg-background/65 px-2 py-1 text-[10px]">
          Accent
          <input
            type="color"
            value={profile.accent}
            className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0"
            onChange={event => updateProfile({ accent: event.target.value })}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Role"><Input value={profile.role ?? ""} onChange={event => updateProfile({ role: event.target.value })} className="h-8 text-xs" placeholder="Captain, driver, advisor…" /></Field>
        <Field label="Username"><Input value={profile.username ?? ""} onChange={event => updateProfile({ username: event.target.value })} className="h-8 text-xs" placeholder="@account" /></Field>
        <Field label="Status">
          <select value={profile.status} onChange={event => updateProfile({ status: event.target.value as PersonPresenceStatus })} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Last seen"><Input value={profile.lastSeen ?? ""} onChange={event => updateProfile({ lastSeen: event.target.value })} className="h-8 text-xs" placeholder="Now, 2 min ago…" /></Field>
      </div>

      <Field label="Personality"><Textarea className="min-h-16 text-xs" value={profile.personality} onChange={event => updateProfile({ personality: event.target.value })} placeholder="Temperament, values, communication style and goals…" /></Field>
      <Field label="Biography"><Textarea className="min-h-16 text-xs" value={profile.biography} onChange={event => updateProfile({ biography: event.target.value })} /></Field>
      <Field label="Traits (comma separated)"><Input className="h-8 text-xs" value={profile.traits.join(", ")} onChange={event => updateProfile({ traits: splitTags(event.target.value, 30) })} /></Field>
      <Field label="Experience (comma separated)"><Input className="h-8 text-xs" value={(profile.experience ?? []).join(", ")} onChange={event => updateProfile({ experience: splitTags(event.target.value, 40) })} /></Field>

      {(profile.experience?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.experience!.map(item => <Badge key={item} variant="secondary" className="text-[9px]">{item}</Badge>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="In-game wallet (DKK)"><Input type="number" min={0} step="0.01" className="h-8 text-xs" value={minorToMajor(profile.walletMinor)} onChange={event => updateProfile({ walletMinor: majorToMinor(event.target.value) })} /></Field>
        <Field label="Maximum recorded (DKK)"><Input type="number" min={0} step="0.01" className="h-8 text-xs" value={minorToMajor(profile.maximumRecordedWalletMinor)} onChange={event => updateProfile({ maximumRecordedWalletMinor: majorToMinor(event.target.value) })} /></Field>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-[10px] text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        Profile metadata is game state. Authoritative faction economy remains controlled by validated simulation commands.
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1"><Label className="text-[10px]">{label}</Label>{children}</div>;
}

function ProfileStat({ icon: Icon, label, value }: { icon: typeof Wifi; label: string; value: string }) {
  return <div className="min-w-0 bg-background/80 p-2"><Icon className="mb-1 h-3 w-3 text-primary" /><div className="text-muted-foreground">{label}</div><strong className="block truncate text-foreground">{value}</strong></div>;
}

function splitTags(value: string, limit: number): string[] {
  return [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))].slice(0, limit);
}

function formatDkk(value = 0): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(value / 100);
}

function minorToMajor(value = 0): string {
  return (value / 100).toFixed(2);
}

function majorToMinor(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function capitalize(value = "unknown"): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusDot(status: PersonPresenceStatus | undefined): string {
  if (status === "online") return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]";
  if (status === "busy") return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]";
  if (status === "offline") return "bg-slate-500";
  return "bg-muted-foreground";
}
