import { BookOpen, Clock3, PlayCircle, Plus, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { countWords } from "../lib/storage";

export function Dashboard() {
  const { state } = useApp();
  const projects = [...state.projects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const latest = projects[0];
  const totalWords = projects.reduce((sum, project) => sum + project.scenes.reduce((sceneSum, scene) => sceneSum + countWords(scene.content), 0), 0);
  return (
    <div className="page container">
      <header className="page-heading">
        <h1>Velkommen tilbage.</h1>
        <p>Fortsæt manuskriptet, start fra en template eller analyser historien med AI.</p>
      </header>
      <section className="stats-grid">
        <Stat icon={<BookOpen />} label="Projekter" value={String(projects.length)} />
        <Stat icon={<Target />} label="Ord i alt" value={totalWords.toLocaleString("da-DK")} />
        <Stat icon={<Clock3 />} label="Streak" value={`${state.goals.streak} dage`} />
      </section>
      {latest && (
        <section className="panel hero-project">
          <div>
            <span className="eyebrow">SENEST REDIGERET</span>
            <h2>{latest.title}</h2>
            <div className="tag-row"><span className="tag">{latest.genre}</span><span className="tag outline">{latest.status}</span></div>
          </div>
          <Link className="button primary" to={`/project/${latest.id}`}><PlayCircle size={17} />Fortsæt</Link>
          <Progress words={latest.scenes.reduce((sum, scene) => sum + countWords(scene.content), 0)} goal={latest.wordGoal} />
        </section>
      )}
      <div className="section-title"><h2>Dine projekter</h2><Link className="button secondary" to="/templates"><Plus size={16} />Nyt projekt</Link></div>
      <section className="project-grid">
        {projects.map((project) => (
          <Link to={`/project/${project.id}`} className="panel project-card" key={project.id}>
            <div className="row-between"><h3>{project.title}</h3><span className="tag">{project.genre}</span></div>
            <p>{project.synopsis}</p>
            <Progress words={project.scenes.reduce((sum, scene) => sum + countWords(scene.content), 0)} goal={project.wordGoal} />
          </Link>
        ))}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="panel stat"><span className="stat-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>;
}
function Progress({ words, goal }: { words: number; goal: number }) {
  const percent = Math.min(100, goal ? (words / goal) * 100 : 0);
  return <div className="progress-wrap"><div className="row-between"><small>Fremdrift</small><small>{words.toLocaleString("da-DK")} / {goal.toLocaleString("da-DK")} ord</small></div><div className="progress"><span style={{ width: `${percent}%` }} /></div></div>;
}
