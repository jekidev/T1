import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
export function TimelinePage() {
  const { id = "" } = useParams(); const { project } = useApp(); const current = project(id);
  if (!current) return <div className="page">Projekt ikke fundet.</div>;
  const events = [...current.timeline].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const conflicts = events.flatMap((event, index) => { const next = events[index + 1]; if (!next || !event.actorId || event.actorId !== next.actorId) return []; return Math.abs(+new Date(next.date) - +new Date(event.date)) < 3600000 ? [`${event.title} og ${next.title} ligger tæt for samme aktør.`] : []; });
  return <div className="page narrow"><Link className="icon-text" to={`/project/${id}`}><ChevronLeft size={17} />Tilbage</Link><header className="page-heading"><h1>Tidslinje</h1><p>Kontrollér rækkefølge, alibier og mulige konflikter.</p></header>{conflicts.length > 0 && <section className="panel warning"><AlertTriangle /> <div><strong>Mulige konflikter</strong>{conflicts.map((conflict) => <p key={conflict}>{conflict}</p>)}</div></section>}<ol className="timeline">{events.map((event) => <li key={event.id}><time>{new Date(event.date).toLocaleString("da-DK")}</time><strong>{event.title}</strong><p>{event.description}</p></li>)}</ol></div>;
}
