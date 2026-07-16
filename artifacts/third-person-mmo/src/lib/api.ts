const API_BASE = '/api';

export interface ScenarioSummary {
  id: number;
  name: string;
  description: string | null;
  mapTemplateId: string;
  updatedAt: string;
  createdAt: string;
}

export interface Scenario {
  id: number;
  name: string;
  description: string | null;
  mapTemplateId: string;
  board: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
}

export interface PlayerTurnAction {
  type: 'invest' | 'gather_intelligence' | 'reduce_pressure' | 'expand_influence' | 'train' | 'wait';
  factionId?: string;
  skillId?: string;
  amount?: number;
}

export interface TurnResolution {
  board: Record<string, unknown>;
  summary: string;
  events: Array<Record<string, unknown>>;
  scenario: Scenario;
}

export interface AdvisorResponse {
  reply: string;
  mode: string;
  model?: string;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchScenarios(): Promise<ScenarioSummary[]> {
  return api('/scenarios');
}

export function fetchScenario(id: number): Promise<Scenario> {
  return api(`/scenarios/${id}`);
}

export function resolveTurn(id: number, action?: PlayerTurnAction): Promise<TurnResolution> {
  return apiPost(`/scenarios/${id}/resolve`, action ?? {});
}

export function advisorChat(role: string, message: string, board: Record<string, unknown>): Promise<AdvisorResponse> {
  return apiPost('/advisor/chat', { role, message, board });
}
