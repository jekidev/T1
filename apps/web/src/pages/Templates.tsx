import { useMemo, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { templates } from "../data/templates";
import { useApp } from "../context/AppContext";

export function TemplatesPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const { createFromTemplate } = useApp();
  const navigate = useNavigate();
  const tags = useMemo(() => [...new Set(templates.flatMap((template) => template.tags))], []);
  const filtered = templates.filter((template) => (!tag || template.tags.includes(tag)) && `${template.name} ${template.description} ${template.subgenre}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="page container">
      <header className="page-heading"><h1>Template-bibliotek</h1><p>Ti strukturer til krimi, thriller og kriminologisk fiktion.</p></header>
      <div className="filter-bar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg templates…" />
        <Filter size={16} />
        <button className={!tag ? "chip active" : "chip"} onClick={() => setTag("")}>Alle</button>
        {tags.map((item) => <button key={item} className={tag === item ? "chip active" : "chip"} onClick={() => setTag(item)}>{item}</button>)}
      </div>
      <section className="template-grid">
        {filtered.map((template) => (
          <article className="panel template-card" key={template.id}>
            <span className="eyebrow">{template.subgenre}</span><h2>{template.name}</h2><p>{template.description}</p>
            <div className="tag-row">{template.tags.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
            <small>{template.chapters.length} kapitler · {template.tone}</small>
            <button className="button primary" onClick={() => { const project = createFromTemplate(template.id); navigate(`/project/${project.id}`); }}><Plus size={16} />Start projekt</button>
          </article>
        ))}
      </section>
    </div>
  );
}
