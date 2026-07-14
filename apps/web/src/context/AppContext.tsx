import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppState, PreviewSnapshot, Project, Scene } from "../types";
import { defaultState, id, loadState, saveState } from "../lib/storage";
import { templates } from "../data/templates";

interface AppContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  project: (id: string) => Project | undefined;
  updateProject: (projectId: string, patch: Partial<Project>) => void;
  updateScene: (projectId: string, sceneId: string, patch: Partial<Scene>) => void;
  createFromTemplate: (templateId: string) => Project;
  addPreview: (projectId: string, preview: PreviewSnapshot) => void;
  exportAll: () => void;
  reset: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  useEffect(() => saveState(state), [state]);

  const value = useMemo<AppContextValue>(() => ({
    state,
    setState,
    project: (projectId) => state.projects.find((p) => p.id === projectId),
    updateProject: (projectId, patch) => setState((current) => ({
      ...current,
      projects: current.projects.map((p) => p.id === projectId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)
    })),
    updateScene: (projectId, sceneId, patch) => setState((current) => ({
      ...current,
      projects: current.projects.map((p) => p.id === projectId ? {
        ...p,
        updatedAt: new Date().toISOString(),
        lastSceneId: sceneId,
        scenes: p.scenes.map((s) => s.id === sceneId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)
      } : p)
    })),
    createFromTemplate: (templateId) => {
      const template = templates.find((t) => t.id === templateId) || templates[0];
      const projectId = id("prj");
      const chapters = template.chapters.map((chapter, index) => ({ id: id("ch"), title: chapter.title, order: index, summary: chapter.beats.join(" • ") }));
      const project: Project = {
        id: projectId,
        title: `Nyt projekt — ${template.name}`,
        genre: template.subgenre,
        status: "idé",
        wordGoal: 40000,
        synopsis: template.description,
        updatedAt: new Date().toISOString(),
        chapters,
        scenes: chapters.map((chapter, index) => ({
          id: id("sc"),
          chapterId: chapter.id,
          title: "Scene 1",
          content: `${template.chapters[index].beats.map((beat) => `• ${beat}`).join("\n")}\n\nSkriv scenen her.`,
          status: "kladde",
          updatedAt: new Date().toISOString()
        })),
        characters: [], evidence: [], timeline: [], relationships: [], research: [], previews: []
      };
      project.lastSceneId = project.scenes[0]?.id;
      setState((current) => ({ ...current, projects: [project, ...current.projects] }));
      return project;
    },
    addPreview: (projectId, preview) => setState((current) => ({
      ...current,
      projects: current.projects.map((p) => p.id === projectId ? { ...p, previews: [preview, ...p.previews] } : p)
    })),
    exportAll: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `casecraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    reset: () => setState(defaultState)
  }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
