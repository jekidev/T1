import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarDays, ChevronLeft, FileSearch, Headphones, Loader2, MessageSquare, Network, Plus, Save, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useTts } from "../context/TtsContext";
import { apiJson } from "../lib/api";
import { countWords, id } from "../lib/storage";
import type { PreviewReport, SceneStatus } from "../types";

export function WorkspacePage() {
  const { id: projectId = "" } = useParams();
  const { project, updateProject, updateScene, addPreview, state, setState } = useApp();
  const tts = useTts();
  const navigate = useNavigate();
  const currentProject = project(projectId);
  const [sceneId, setSceneId] = useState(currentProject?.lastSceneId || currentProject?.scenes[0]?.id || "");
  const [saveLabel, setSaveLabel] = useState("Gemt");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{ role: "assistant", content: "Jeg er din skrivecoach. Jeg kan analysere scene, kapitel eller hele historien." }]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"none" | "structure" | "chat">("none");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { if (currentProject && !sceneId) setSceneId(currentProject.scenes[0]?.id || ""); }, [currentProject, sceneId]);
  if (!currentProject) return <div className="page narrow"><p>Projektet blev ikke fundet.</p><Link to="/">Tilbage</Link></div>;
  const scene = currentProject.scenes.find((item) => item.id === sceneId) || currentProject.scenes[0];
  const chapter = currentProject.chapters.find((item) => item.id === scene?.chapterId);
  const manuscript = currentProject.scenes.map((item) => `${item.title}\n\n${item.content}`).join("\n\n");

  const changeContent = (content: string) => {
    if (!scene) return;
    setSaveLabel(navigator.onLine ? "Gemmer…" : "Offline");
    updateScene(currentProject.id, scene.id, { content });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaveLabel(navigator.onLine ? "Gemt" : "Offline"), 350);
  };

  const addScene = (chapterId: string) => {
    const next = { id: id("sc"), chapterId, title: "Ny scene", content: "", status: "kladde" as SceneStatus, updatedAt: new Date().toISOString() };
    setState((current) => ({ ...current, projects: current.projects.map((item) => item.id === currentProject.id ? { ...item, scenes: [...item.scenes, next], lastSceneId: next.id } : item) }));
    setSceneId(next.id);
  };

  const askAi = async () => {
    if (!chatInput.trim()) return;
    const user = { role: "user" as const, content: chatInput.trim() };
    setChat((items) => [...items, user]); setChatInput(""); setChatBusy(true);
    try {
      const result = await apiJson<{ text: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ provider: state.ai.chatProvider, model: state.ai.chatModel, baseUrl: state.ai.customBaseUrl, messages: [{ role: "system", content: `Du er en dansk skrivecoach og kriminolog. Kontekst:\n${scene?.content || ""}` }, ...chat, user] }) });
      setChat((items) => [...items, { role: "assistant", content: result.text }]);
    } catch {
      setChat((items) => [...items, { role: "assistant", content: "Demo-feedback: Scenen har en stærk atmosfære. Gør næste vendepunkt fysisk synligt og lad karakterens valg få en umiddelbar pris." }]);
    } finally { setChatBusy(false); }
  };

  const makePreview = async () => {
    setPreviewBusy(true);
    try {
      const result = await apiJson<{ report: PreviewReport }>("/api/ai/preview", { method: "POST", body: JSON.stringify({ provider: state.ai.chatProvider, model: state.ai.analysisModel, title: currentProject.title, genre: currentProject.genre, manuscript }) });
      addPreview(currentProject.id, { id: id("preview"), createdAt: new Date().toISOString(), wordCount: countWords(manuscript), report: result.report });
    } catch {
      const report: PreviewReport = {
        synopsis: `${currentProject.title} følger en efterforsker, der gradvist opdager, at sagen og byens forvandling hænger sammen.`, genre: currentProject.genre, tone: "Mørk, atmosfærisk og tilbageholdt.", plot: "Åbningsakten er etableret. Midtpunktet bør tvinge hovedpersonen til en irreversibel beslutning.", pacing: "Første scene er stærk; afhøringen kan strammes med mere konflikt.", characters: "Malene har en klar stemme. Bipersonerne bør få egne mål uden for sagen.", continuity: ["Kontrollér tidsrummet mellem sms og fund.", "Rasmus' anciennitet skal være ens alle steder."], clues: "Sms-sporet fungerer. Plant ét diskret modspor før næste afsløring.", criminology: "Routine activity theory er relevant, men teorien bør bruges som perspektiv, ikke facit.", strengths: ["Stærkt miljø", "Tydelig hovedperson", "God sanselighed"], weaknesses: ["Midtpunkt mangler", "En biperson er underudviklet", "Tidslinjen kræver kontrol"], nextSteps: ["Definér midtpunktet", "Giv Line en scene med egen agens", "Kontrollér tidslinjen", "Plant et modspor", "Forbind tema og valg"], nextSceneSuggestion: "Malene besøger obduktionslokalet alene. Scenen handler ikke om nye oplysninger, men om at se offeret som person."
      };
      addPreview(currentProject.id, { id: id("preview"), createdAt: new Date().toISOString(), wordCount: countWords(manuscript), report });
    } finally { setPreviewBusy(false); navigate(`/project/${currentProject.id}/previews`); }
  };

  return (
    <div className="workspace-page">
      <div className="workspace-header"><Link to="/" className="icon-text"><ChevronLeft size={17} />Dashboard</Link><h1>{currentProject.title}</h1><span className="tag">{currentProject.genre}</span><span className="save-state"><Save size={14} />{saveLabel}</span></div>
      <div className="mobile-workspace-actions"><button onClick={() => setMobilePanel("structure")}><BookOpen size={16} />Struktur</button><button onClick={() => setMobilePanel("chat")}><MessageSquare size={16} />AI-chat</button></div>
      <div className="workspace-grid">
        <aside className={`workspace-sidebar ${mobilePanel === "structure" ? "mobile-open" : ""}`}>
          <button className="mobile-close" onClick={() => setMobilePanel("none")}>Luk</button>
          <span className="eyebrow">MANUSKRIPT</span>
          {currentProject.chapters.map((item) => <div className="chapter" key={item.id}><div className="row-between"><strong>{item.title}</strong><button onClick={() => addScene(item.id)}><Plus size={14} /></button></div>{currentProject.scenes.filter((candidate) => candidate.chapterId === item.id).map((candidate) => <button className={candidate.id === scene?.id ? "scene-link active" : "scene-link"} key={candidate.id} onClick={() => { setSceneId(candidate.id); setMobilePanel("none"); }}>{candidate.title}<small>{countWords(candidate.content)}</small></button>)}</div>)}
          <div className="side-links"><Link to={`/project/${currentProject.id}/case-board`}><Network size={15} />Case board</Link><Link to={`/project/${currentProject.id}/timeline`}><CalendarDays size={15} />Tidslinje</Link><Link to={`/project/${currentProject.id}/previews`}><FileSearch size={15} />Previews</Link></div>
        </aside>
        <main className="editor-panel panel">
          {scene && <>
            <div className="editor-toolbar"><input value={scene.title} onChange={(event) => updateScene(currentProject.id, scene.id, { title: event.target.value })} /><select value={scene.status} onChange={(event) => updateScene(currentProject.id, scene.id, { status: event.target.value as SceneStatus })}><option value="kladde">Kladde</option><option value="arbejde">Under arbejde</option><option value="revideret">Revideret</option><option value="færdig">Færdig</option></select><span>{countWords(scene.content)} ord</span><button className="button secondary" onClick={() => void tts.startText(`${currentProject.title} — ${scene.title}`, scene.content)}><Headphones size={16} />Læs højt</button></div>
            <textarea className="manuscript" value={scene.content} onChange={(event) => changeContent(event.target.value)} placeholder="Skriv din scene…" />
          </>}
          <div className="editor-footer"><button className="button primary" disabled={previewBusy} onClick={() => void makePreview()}>{previewBusy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}Make AI Preview</button><button className="button secondary" onClick={() => void tts.startText(currentProject.title, manuscript)}><Headphones size={17} />Læs hele historien</button></div>
        </main>
        <aside className={`ai-panel panel ${mobilePanel === "chat" ? "mobile-open" : ""}`}>
          <button className="mobile-close" onClick={() => setMobilePanel("none")}>Luk</button><span className="eyebrow">AI-ASSISTENT</span><div className="chat-messages">{chat.map((message, index) => <div key={index} className={`chat-bubble ${message.role}`}>{message.content}<button className="speak-small" onClick={() => void tts.startText("AI-svar", message.content)}><Headphones size={13} /></button></div>)}{chatBusy && <div className="chat-bubble assistant"><Loader2 className="spin" size={16} /> Tænker…</div>}</div><div className="chat-input"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={`Spørg om ${chapter?.title || "scenen"}…`} /><button className="button primary" onClick={() => void askAi()}>Send</button></div>
        </aside>
      </div>
    </div>
  );
}
