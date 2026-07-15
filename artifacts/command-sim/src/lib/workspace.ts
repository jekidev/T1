export type LlmWorkspaceMode = "talk" | "plan" | "build";
export type WorkflowStepKind =
  | "talk"
  | "plan"
  | "build"
  | "create_storyline"
  | "integrate_github_repo"
  | "import_asset"
  | "update_world"
  | "scan_telegram_people"
  | "custom_prompt";

export interface WorkspaceWorkflowStep {
  id: string;
  kind: WorkflowStepKind;
  title: string;
  prompt: string;
  config: Record<string, string | number | boolean>;
}

export interface WorkspaceWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkspaceWorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "mcp" | "integration" | "visual";
}

export interface WorkspaceHyperlink {
  id: string;
  label: string;
  url: string;
  category: string;
}

export interface WorkspaceAsset {
  id: string;
  name: string;
  mimeType: string;
  sourceId: string;
  sourceUrl: string;
  origin: "upload" | "chatgpt" | "grok" | "other";
  createdAt: string;
}

export interface IntegratedRepository {
  id: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  integratedAt: string;
}

export interface UserWorkspaceState {
  version: 1;
  chatMode: LlmWorkspaceMode;
  workflows: WorkspaceWorkflow[];
  plugins: WorkspacePlugin[];
  hyperlinks: WorkspaceHyperlink[];
  assets: WorkspaceAsset[];
  repositories: IntegratedRepository[];
}

const STORAGE_KEY = "t1-user-workspace-v1";

export function defaultWorkspaceState(): UserWorkspaceState {
  const now = new Date().toISOString();
  return {
    version: 1,
    chatMode: "talk",
    workflows: [
      {
        id: "workflow-create-storyline",
        name: "Create Storyline",
        description: "Talk → plan → build a validated storyline together with the LLM.",
        createdAt: now,
        updatedAt: now,
        steps: [
          step("talk", "Story discovery", "Discuss the world, player fantasy, themes, factions, locations and constraints before changing state."),
          step("plan", "Story architecture", "Produce a structured five-act storyline plan with missions, dependencies, factions, assets, consequences and validation checks."),
          step("build", "Build storyline", "Convert the approved plan into validated game entities, phases, events, factions, shops, skills and map anchors."),
        ],
      },
      {
        id: "workflow-integrate-github",
        name: "Integrate GitHub Repo",
        description: "Inspect a selected repository, plan an adapter and build only validated project-compatible changes.",
        createdAt: now,
        updatedAt: now,
        steps: [
          step("plan", "Repository integration plan", "Analyze the selected repository architecture, license and reusable patterns. Produce an adapter-first integration plan."),
          step("integrate_github_repo", "Bind repository", "Attach the selected GitHub repository metadata and target branch to this workflow."),
          step("build", "Build adapter", "Implement the approved integration through the project's existing TypeScript, command, event and plugin boundaries."),
        ],
      },
    ],
    plugins: [
      { id: "plugin-github", name: "GitHub Workspace", description: "Owned/starred repositories, creation and integration workflows.", enabled: true, category: "integration" },
      { id: "plugin-assets", name: "Universal Assets", description: "Images, video and generated media for every user.", enabled: true, category: "core" },
      { id: "plugin-telegram", name: "Telegram MCP Units", description: "Import explicitly selected Telegram people as fictional board units.", enabled: false, category: "mcp" },
      { id: "plugin-rag", name: "RAG World Update", description: "Append-only knowledge imports and deterministic NPC refresh.", enabled: true, category: "core" },
      { id: "plugin-map", name: "Google Maps World", description: "Google Maps preflight and real-map board foundation.", enabled: true, category: "visual" },
    ],
    hyperlinks: [
      { id: "link-github", label: "GitHub", url: "https://github.com", category: "Development" },
      { id: "link-openrouter", label: "OpenRouter", url: "https://openrouter.ai", category: "Models" },
      { id: "link-google-maps", label: "Google Maps Platform", url: "https://console.cloud.google.com/google/maps-apis", category: "Maps" },
      { id: "link-huggingface", label: "Hugging Face", url: "https://huggingface.co", category: "RAG & Models" },
    ],
    assets: [],
    repositories: [],
  };
}

export function loadWorkspaceState(): UserWorkspaceState {
  if (typeof window === "undefined") return defaultWorkspaceState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<UserWorkspaceState> | null;
    const defaults = defaultWorkspaceState();
    if (!parsed || parsed.version !== 1) return defaults;
    return {
      ...defaults,
      ...parsed,
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : defaults.workflows,
      plugins: Array.isArray(parsed.plugins) ? parsed.plugins : defaults.plugins,
      hyperlinks: Array.isArray(parsed.hyperlinks) ? parsed.hyperlinks : defaults.hyperlinks,
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [],
    };
  } catch {
    return defaultWorkspaceState();
  }
}

export function saveWorkspaceState(state: UserWorkspaceState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function newWorkflowStep(kind: WorkflowStepKind, title?: string): WorkspaceWorkflowStep {
  return step(kind, title ?? labelForStep(kind), "");
}

export function createWorkflow(name: string, description: string, steps: WorkspaceWorkflowStep[]): WorkspaceWorkflow {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, description, steps, createdAt: now, updatedAt: now };
}

function step(kind: WorkflowStepKind, title: string, prompt: string): WorkspaceWorkflowStep {
  return { id: crypto.randomUUID(), kind, title, prompt, config: {} };
}

function labelForStep(kind: WorkflowStepKind): string {
  return kind.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
