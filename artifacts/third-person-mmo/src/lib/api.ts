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

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
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
