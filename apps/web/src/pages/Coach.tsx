import { Flame, Sparkles, Target } from "lucide-react";
import { useApp } from "../context/AppContext";
import { countWords } from "../lib/storage";

const exercises = [
  "Skriv en scene hvor et vidne lyver. Kun ét spørgsmål må stilles direkte.",
  "Beskriv et gerningssted uden at nævne offeret. Læseren skal ane det gennem detaljer.",
  "Skriv en dialog hvor to karakterer taler om noget andet end det, sagen egentlig handler om.",
  "Beskriv samme hændelse fra tre POVs. Behold den mest overraskende version.",
  "Skriv præcis 200 ord og slut med en beslutning, der ikke kan trækkes tilbage."
];

export function CoachPage() {
  const { state, setState } = useApp();
  const today = new Date().toDateString();
  const words = state.projects.flatMap((project) => project.scenes).filter((scene) => new Date(scene.updatedAt).toDateString() === today).reduce((sum, scene) => sum + countWords(scene.content), 0);
  const percent = Math.min(100, (words / state.goals.dailyWordGoal) * 100);
  return (
    <div className="page narrow">
      <header className="page-heading"><h1>Skrivecoach</h1><p>Daglige mål, øvelser og feedback uden automatisk overskrivning.</p></header>
      <div className="two-grid">
        <section className="panel coach-card"><Target /><span className="eyebrow">DAGENS MÅL</span><strong>{words} / {state.goals.dailyWordGoal} ord</strong><div className="progress"><span style={{ width: `${percent}%` }} /></div><input type="number" value={state.goals.dailyWordGoal} onChange={(event) => setState((current) => ({ ...current, goals: { ...current.goals, dailyWordGoal: Number(event.target.value) || 0 } }))} /></section>
        <section className="panel coach-card"><Flame /><span className="eyebrow">STREAK</span><strong>{state.goals.streak} dage</strong><p>Skriv mindst ét ord om dagen for at holde rytmen.</p></section>
        <section className="panel coach-card wide"><Sparkles /><span className="eyebrow">DAGENS ØVELSE</span><blockquote>{exercises[new Date().getDate() % exercises.length]}</blockquote></section>
      </div>
    </div>
  );
}
