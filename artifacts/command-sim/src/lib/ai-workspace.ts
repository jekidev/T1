export type LlmRoutingMode = 'rotate' | 'static' | 'off';

export interface AiMemory {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface McpServerDefinition {
  id: string;
  name: string;
  transport: 'platform-connection' | 'http' | 'stdio' | 'internal';
  endpoint?: string;
  enabled: boolean;
  capabilities: string[];
  requiresApprovalForWrites: boolean;
}

export interface AiWorkspaceProfile {
  id: string;
  name: string;
  description: string;
  routing: {
    mode: LlmRoutingMode;
    staticModel: string;
    models: string[];
  };
  systemPrompt: string;
  rules: string[];
  skills: string[];
  memories: AiMemory[];
  mcpServers: McpServerDefinition[];
}

const STORAGE_KEY = 'urban-strategy-ai-workspace-profiles-v1';
const ACTIVE_KEY = 'urban-strategy-ai-workspace-active-v1';

const DEFAULT_MCP_SERVERS: McpServerDefinition[] = [
  { id: 'memory', name: 'Memory MCP', transport: 'internal', enabled: true, capabilities: ['memory.list', 'memory.create', 'memory.update', 'memory.delete'], requiresApprovalForWrites: true },
  { id: 'filesystem', name: 'Filesystem MCP', transport: 'internal', enabled: true, capabilities: ['filesystem.list', 'filesystem.read'], requiresApprovalForWrites: false },
  { id: 'github', name: 'GitHub MCP', transport: 'http', endpoint: 'https://api.githubcopilot.com/mcp/', enabled: false, capabilities: ['repository.read', 'code.search', 'issues.read', 'pull_requests.read', 'propose_patch'], requiresApprovalForWrites: true },
  { id: 'google-drive', name: 'Google Drive', transport: 'platform-connection', enabled: false, capabilities: ['search_documents', 'read_documents'], requiresApprovalForWrites: true },
  { id: 'huggingface', name: 'Hugging Face Hub MCP', transport: 'http', endpoint: 'https://huggingface.co/mcp', enabled: false, capabilities: ['hub.search', 'models.read', 'datasets.read', 'spaces.read'], requiresApprovalForWrites: true },
  { id: 'google-maps', name: 'Google Maps MCP', transport: 'http', enabled: false, capabilities: ['maps.geocode', 'maps.places', 'maps.routes', 'maps.distance_matrix'], requiresApprovalForWrites: false },
  { id: 'playwright', name: 'Playwright MCP', transport: 'stdio', enabled: false, capabilities: ['browser.navigate', 'browser.inspect', 'browser.screenshot', 'browser.interact'], requiresApprovalForWrites: true },
  { id: 'telegram-auth', name: 'Telegram Auth API', transport: 'http', enabled: false, capabilities: ['telegram.auth.start', 'telegram.auth.verify', 'telegram.auth.status', 'telegram.auth.logout'], requiresApprovalForWrites: true },
  { id: 'telegram', name: 'Telegram MCP', transport: 'stdio', enabled: false, capabilities: ['telegram.chats.read', 'telegram.messages.read', 'telegram.search', 'telegram.messages.send', 'telegram.messages.edit', 'telegram.messages.delete', 'telegram.messages.forward', 'telegram.groups.manage'], requiresApprovalForWrites: true },
  { id: 'rsshub', name: 'RSSHub', transport: 'http', enabled: false, capabilities: ['rss.fetch', 'rss.search'], requiresApprovalForWrites: false },
];

export const DEFAULT_AI_PROFILE: AiWorkspaceProfile = {
  id: 'game-co-designer',
  name: 'Game Co-Designer',
  description: 'Plays the game with the user and helps develop it from live state and telemetry.',
  routing: {
    mode: 'rotate',
    staticModel: 'nvidia/nemotron-nano-9b-v2:free',
    models: [
      'nvidia/nemotron-nano-9b-v2:free',
      'google/gemma-4-26b-a4b-it:free',
      'mistralai/mistral-nemo',
    ],
  },
  systemPrompt:
    'You are the Game Co-Designer inside Urban Strategy Simulator. Play with the user, observe live state and telemetry, explain what is happening, and propose controlled improvements.',
  rules: [
    'Separate observed facts from suggestions.',
    'Never claim a code change was applied without a confirmed tool result.',
    'Do not expose or store credentials.',
    'Do not execute untrusted integration scripts.',
    'Any MCP write or modify operation requires explicit approval.',
  ],
  skills: ['gameplay-analysis', 'debugging', 'ux-review', 'balance-review', 'feature-planning', 'path-planning', 'evolution-audit'],
  memories: [
    {
      id: 'project-purpose',
      title: 'Project purpose',
      content: 'The game is played with AI and developed with AI through an observe-propose-apply workflow.',
      enabled: true,
    },
  ],
  mcpServers: DEFAULT_MCP_SERVERS,
};

function cloneProfile(profile: AiWorkspaceProfile): AiWorkspaceProfile {
  return JSON.parse(JSON.stringify(profile)) as AiWorkspaceProfile;
}

function mergeMcpDefaults(profile: AiWorkspaceProfile): AiWorkspaceProfile {
  const existing = new Map(profile.mcpServers.map(server => [server.id, server]));
  return {
    ...profile,
    mcpServers: DEFAULT_MCP_SERVERS.map(server => ({ ...server, ...(existing.get(server.id) ?? {}) })),
  };
}

export function loadAiProfiles(): AiWorkspaceProfile[] {
  if (typeof window === 'undefined') return [cloneProfile(DEFAULT_AI_PROFILE)];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as AiWorkspaceProfile[];
    return stored.length > 0 ? stored.map(mergeMcpDefaults) : [cloneProfile(DEFAULT_AI_PROFILE)];
  } catch {
    return [cloneProfile(DEFAULT_AI_PROFILE)];
  }
}

export function saveAiProfiles(profiles: AiWorkspaceProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function loadActiveAiProfileId(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_AI_PROFILE.id;
}

export function saveActiveAiProfileId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function createAiProfile(source: AiWorkspaceProfile = DEFAULT_AI_PROFILE): AiWorkspaceProfile {
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    ...cloneProfile(source),
    id: `${source.id}-${suffix}`,
    name: `${source.name} Copy`,
  };
}

export function buildAiProfileContext(profile: AiWorkspaceProfile): string {
  const enabledMemories = profile.memories.filter((memory) => memory.enabled);
  const enabledMcp = profile.mcpServers.filter((server) => server.enabled);

  return [
    `AI Workspace profile: ${profile.name}`,
    `Description: ${profile.description}`,
    `Routing mode: ${profile.routing.mode}`,
    `Static model: ${profile.routing.staticModel}`,
    `Rotation models: ${profile.routing.models.join(', ')}`,
    `System prompt: ${profile.systemPrompt}`,
    `Rules:\n${profile.rules.map((rule) => `- ${rule}`).join('\n')}`,
    `Skills: ${profile.skills.join(', ')}`,
    `Enabled memories:\n${enabledMemories.map((memory) => `- ${memory.title}: ${memory.content}`).join('\n') || '- none'}`,
    `Enabled MCP connections:\n${enabledMcp.map((server) => `- ${server.name}: ${server.capabilities.join(', ')}; approval for writes=${server.requiresApprovalForWrites}`).join('\n') || '- none'}`,
    'MCP definitions describe available connections only. Do not claim a tool call occurred unless a real tool result is supplied.',
  ].join('\n\n');
}
