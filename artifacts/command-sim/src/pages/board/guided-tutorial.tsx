import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Map,
  MousePointer2,
  PanelRight,
  Smartphone,
  Sparkles,
  UserRound,
} from "lucide-react";

interface GuidedTutorialProps {
  open: boolean;
  onClose: () => void;
  scenarioName: string;
  city?: string;
  generatedSummary?: string;
}

export function GuidedTutorial({
  open,
  onClose,
  scenarioName,
  city = "din valgte by",
  generatedSummary,
}: GuidedTutorialProps) {
  const [step, setStep] = useState(0);
  const steps = useMemo(() => [
    {
      title: "ELI5: Hvad er spillebrættet?",
      icon: Map,
      body: `Tænk på ${scenarioName} som et digitalt brætspil oven på et rigtigt kort over ${city}. Google Maps eller OpenStreetMap viser geografien. Spillets zoner, personer, assets og hændelser ligger som et interaktivt lag ovenpå.`,
      action: "Zoom og panorér kortet. Brug World-knappen til at ændre by, radius og startområde.",
    },
    {
      title: "Placér og vælg ting",
      icon: MousePointer2,
      body: "Venstre side er din palette. Træk entities til brættet. Personer bliver fremhævet ved hover; klik eller tap vælger dem og åbner deres profil.",
      action: "Tilføj mindst én person, location eller objective og vælg den på brættet.",
    },
    {
      title: "Byg en rigtig personprofil",
      icon: UserRound,
      body: "Profile-fanen viser avatar, rolle, username, presence-status, sidste aktivitet, personlighed, biografi, traits, erfaring og in-game wallet. Uploadede billeder går gennem projektets asset-service—ikke en separat demo-store.",
      action: "Vælg en unit, upload et profilbillede, og tilføj rolle plus to erfaringstags.",
    },
    {
      title: "Styr scene og environment",
      icon: CloudRain,
      body: "Scene-fanen gemmer scene-navn, vejr, årstid, lokal tid, temperatur og map mode direkte i board-state. Den lokale fallback-scene kan bruges, når Google/OSM ikke er tilgængelig.",
      action: "Åbn Profile-panelets Scene-fane og vælg vejr, årstid og korttilstand.",
    },
    {
      title: "Spil og byg med Nyx",
      icon: Bot,
      body: "Chatten nederst til højre er både game master og udviklingsværktøj. Du kan bede AI'en forklare situationen, bygge storyline, foreslå assets, skabe missioner eller analysere Red Team og Blue Team.",
      action: "Skriv: “ELI5: Hvad bør jeg gøre i første tur?”",
    },
    {
      title: "Kopiér, indsæt og markér tekst",
      icon: PanelRight,
      body: "Alt tekst i chatten kan markeres. Hver besked har kopieringsfunktion, og inputfeltet understøtter almindelig copy/paste samt Ctrl/Cmd+A.",
      action: "Markér et AI-svar, kopiér det, og indsæt det igen som en ny instruktion eller note.",
    },
    {
      title: "Android og små skærme",
      icon: Smartphone,
      body: "På telefonen skifter arbejdsområdet til fanerne Board, Add, Profile, Play, Score og AI. Det er de samme data og komponenter som desktop—ikke en separat mobilversion.",
      action: "På mobil: vælg Board, tap en person, og skift derefter til Profile.",
    },
    {
      title: "Din AI-genererede start",
      icon: Sparkles,
      body: generatedSummary || "Ved New Game bygger AI'en den første storyline, factions, starter-assets, shops, skills, mission og tutorial. Alt gemmes i board-state og kan videreudvikles i chatten.",
      action: "Åbn scoring, timeline og Developer AI, og fortsæt derefter Act I.",
    },
    {
      title: "Klar",
      icon: CheckCircle2,
      body: "Du behøver ikke forstå alle systemer på én gang. Start med kortet, vælg én person eller mission, spørg Nyx om næste skridt, og lad spillet reagere på dine valg.",
      action: "Luk tutorialen og begynd første tur.",
    },
  ], [scenarioName, city, generatedSummary]);

  const current = steps[step]!;
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto select-text sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/15 p-2"><Icon className="h-5 w-5 text-primary" /></div>
            <DialogTitle>{current.title}</DialogTitle>
          </div>
          <DialogDescription>Guided start · {step + 1}/{steps.length}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <p className="text-sm leading-relaxed">{current.body}</p>
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"><strong>Gør dette nu:</strong> {current.action}</div>
          <div className="flex gap-1">{steps.map((_, index) => <div key={index} className={`h-1.5 flex-1 rounded ${index <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>
          {step < steps.length - 1
            ? <Button onClick={() => setStep(step + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            : <Button onClick={onClose}><CheckCircle2 className="mr-1 h-4 w-4" />Start game</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
