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
  /** Narrative stance only: 1 = maximally ruthless/evil, 100 = maximally benevolent/good. */
  llmMoralSpectrum: number;
  workflows: WorkspaceWorkflow[];
  plugins: WorkspacePlugin[];
  hyperlinks: WorkspaceHyperlink[];
  assets: WorkspaceAsset[];
  repositories: IntegratedRepository[];
}

export const WORKSPACE_UPDATED_EVENT = "t1:workspace-updated";
const STORAGE_KEY = "t1-user-workspace-v1";

export function defaultWorkspaceState(): UserWorkspaceState {
  const now = new Date().toISOString();
  return {
    version: 1,
    chatMode: "talk",
    llmMoralSpectrum: 50,
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
        id: "workflow-build-player",
        name: "Build Player",
        description: "Talk → plan → build the boss identity, personality, biography and starting visual profile.",
        createdAt: now,
        updatedAt: now,
        steps: [
          step("talk", "Player discovery", "Ask focused questions about the boss name, identity, personality, biography, visual style, strengths, weaknesses and intended moral direction."),
          step("plan", "Player profile plan", "Produce a compact player-profile plan and identify missing information. Do not modify the board."),
          step("build", "Build player profile", "Return an additive build proposal containing playerProfile with name, biography, personality, traits and optional avatarUrl. Preserve boss role, zero starting capital and solo start."),
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
      chatMode: parsed.chatMode === "talk" || parsed.chatMode === "plan" || parsed.chatMode === "build" ? parsed.chatMode : defaults.chatMode,
      llmMoralSpectrum: clampMoralSpectrum(parsed.llmMoralSpectrum ?? defaults.llmMoralSpectrum),
      workflows: mergeDefaultWorkflows(Array.isArray(parsed.workflows) ? parsed.workflows : [], defaults.workflows),
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
  const normalized = { ...state, llmMoralSpectrum: clampMoralSpectrum(state.llmMoralSpectrum) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<UserWorkspaceState>(WORKSPACE_UPDATED_EVENT, { detail: normalized }));
}

export function buildLlmWorkspaceContext(stateInput = loadWorkspaceState()): string {
  const state = { ...stateInput, llmMoralSpectrum: clampMoralSpectrum(stateInput.llmMoralSpectrum) };
  const stance = describeMoralSpectrum(state.llmMoralSpectrum);
  const common = [
    "LLM WORKSPACE AUTHORITY:",
    `- Active collaboration mode: ${state.chatMode.toUpperCase()}.`,
    `- Selected narrative moral stance: ${state.llmMoralSpectrum}/100 (${stance}).`,
    "- The moral setting controls fictional tone, priorities, dialogue and trade-offs. It does not bypass validation, permissions, network approval, schemas or game rules.",
    "- The player is the boss, starts alone and has zero starting capital unless later changed by a validated gameplay event.",
  ];

  if (state.chatMode === "talk") {
    return [...common,
      "TALK MODE:",
      "- Collaborate conversationally, ask focused questions and develop ideas.",
      "- Do not output an apply-ready state mutation unless the user explicitly switches to Build mode.",
    ].join("\n");
  }
  if (state.chatMode === "plan") {
    return [...common,
      "PLAN MODE:",
      "- Produce a structured plan with assumptions, dependencies, affected modules, risks, validation steps and acceptance criteria.",
      "- Do not claim that board or repository state has changed.",
      "- Stop before implementation and identify the exact approval needed to continue.",
    ].join("\n");
  }
  return [...common,
    "BUILD MODE:",
    "- Produce only additive, reviewable changes based on the approved plan.",
    "- For board building, include one fenced JSON object using this optional schema:",
    '{"notesAppend":"string","playerProfile":{"name":"string","biography":"string","personality":"string","traits":["string"],"avatarUrl":"optional https URL"},"phases":[{"name":"string","description":"string"}],"timelineEvents":[{"label":"string","description":"string","severity":"info|caution|critical"}],"entities":[{"label":"string","category":"unit|location|resource|objective|evidence|vehicle|civilian|event","faction":"police|criminal|neutral","notes":"string"}]}',
    "- Omit sections that are not requested. Never delete or rewrite existing RAG, DeepSeek conversations or existing board content.",
    "- The user must press Apply before a board proposal becomes authoritative.",
  ].join("\n");
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

function clampMoralSpectrum(value: number): number {
  return Math.max(1, Math.min(100, Number.isFinite(value) ? Math.round(value) : 50));
}

function describeMoralSpectrum(value: number): string {
  if (value <= 20) return "ruthless / strongly evil";
  if (value <= 40) return "self-interested / morally dark";
  if (value <= 60) return "mixed / pragmatic";
  if (value <= 80) return "principled / generally good";
  return "benevolent / strongly good";
}

function mergeDefaultWorkflows(current: WorkspaceWorkflow[], defaults: WorkspaceWorkflow[]): WorkspaceWorkflow[] {
  const byId = new Map(current.map(workflow => [workflow.id, workflow]));
  for (const workflow of defaults) if (!byId.has(workflow.id)) byId.set(workflow.id, workflow);
  return [...byId.values()];
}
