export type SceneStatus = "kladde" | "arbejde" | "revideret" | "færdig";

export interface Scene {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  status: SceneStatus;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  summary?: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  motive?: string;
  bio?: string;
}

export interface Evidence {
  id: string;
  name: string;
  kind: string;
  reliability: "verificeret" | "usikker" | "red_herring";
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  actorId?: string;
}

export interface PreviewReport {
  synopsis: string;
  genre: string;
  tone: string;
  plot: string;
  pacing: string;
  characters: string;
  continuity: string[];
  clues: string;
  criminology: string;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  nextSceneSuggestion: string;
}

export interface PreviewSnapshot {
  id: string;
  createdAt: string;
  wordCount: number;
  report: PreviewReport;
}

export interface Project {
  id: string;
  title: string;
  genre: string;
  status: "idé" | "udkast" | "revision" | "færdig";
  wordGoal: number;
  synopsis: string;
  updatedAt: string;
  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  relationships: Array<{ id: string; fromId: string; toId: string; label: string }>;
  research: Array<{ id: string; title: string; body: string; status: string }>;
  previews: PreviewSnapshot[];
  lastSceneId?: string;
}

export interface Template {
  id: string;
  name: string;
  subgenre: string;
  description: string;
  tone: string;
  tags: string[];
  chapters: Array<{ title: string; beats: string[] }>;
}

export type ProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "mistral"
  | "elevenlabs"
  | "github"
  | "custom";

export interface AiSettings {
  chatProvider: ProviderId;
  chatModel: string;
  rewriteModel: string;
  analysisModel: string;
  researchModel: string;
  fallback: string[];
  onlyFree: boolean;
  customBaseUrl: string;
  customModel: string;
}

export interface TtsSettings {
  provider: "browser" | "openai" | "elevenlabs" | "custom";
  model: string;
  voice: string;
  format: "mp3" | "wav" | "opus";
  speed: number;
  maxChunkLength: number;
  customBaseUrl: string;
}

export interface GithubSettings {
  owner: string;
  repo: string;
  branch: string;
}

export interface AppState {
  projects: Project[];
  ai: AiSettings;
  tts: TtsSettings;
  github: GithubSettings;
  goals: { dailyWordGoal: number; streak: number };
}
