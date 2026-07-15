export interface ScenarioRecord {
  id: number;
  name: string;
  description: string | null;
  mapTemplateId: string;
  board: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
}

export interface SnapshotRecord {
  id: number;
  scenarioId: number;
  label: string;
  board: Record<string, unknown>;
  createdAt: Date;
}

const scenarios = new Map<number, ScenarioRecord>();
const snapshots = new Map<number, SnapshotRecord>();
let nextScenarioId = 1;
let nextSnapshotId = 1;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function listScenarios(): ScenarioRecord[] {
  return [...scenarios.values()]
    .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
    .map(clone);
}

export function getScenario(id: number): ScenarioRecord | undefined {
  const scenario = scenarios.get(id);
  return scenario ? clone(scenario) : undefined;
}

export function createScenario(input: {
  name: string;
  description?: string;
  mapTemplateId: string;
  board: Record<string, unknown>;
}): ScenarioRecord {
  const now = new Date();
  const scenario: ScenarioRecord = {
    id: nextScenarioId++,
    name: input.name,
    description: input.description ?? null,
    mapTemplateId: input.mapTemplateId,
    board: clone(input.board),
    createdAt: now,
    updatedAt: now,
  };
  scenarios.set(scenario.id, scenario);
  return clone(scenario);
}

export function updateScenario(
  id: number,
  input: {
    name?: string;
    description?: string;
    mapTemplateId?: string;
    board?: Record<string, unknown>;
  },
): ScenarioRecord | undefined {
  const scenario = scenarios.get(id);
  if (!scenario) return undefined;

  const updated: ScenarioRecord = {
    ...scenario,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.mapTemplateId !== undefined
      ? { mapTemplateId: input.mapTemplateId }
      : {}),
    ...(input.board !== undefined ? { board: clone(input.board) } : {}),
    updatedAt: new Date(),
  };
  scenarios.set(id, updated);
  return clone(updated);
}

export function deleteScenario(id: number): boolean {
  if (!scenarios.delete(id)) return false;
  for (const [snapshotId, snapshot] of snapshots) {
    if (snapshot.scenarioId === id) snapshots.delete(snapshotId);
  }
  return true;
}

export function listSnapshots(scenarioId: number): SnapshotRecord[] {
  return [...snapshots.values()]
    .filter((snapshot) => snapshot.scenarioId === scenarioId)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map(clone);
}

export function getSnapshot(
  scenarioId: number,
  snapshotId: number,
): SnapshotRecord | undefined {
  const snapshot = snapshots.get(snapshotId);
  return snapshot?.scenarioId === scenarioId ? clone(snapshot) : undefined;
}

export function createSnapshot(input: {
  scenarioId: number;
  label: string;
  board: Record<string, unknown>;
}): SnapshotRecord {
  const snapshot: SnapshotRecord = {
    id: nextSnapshotId++,
    scenarioId: input.scenarioId,
    label: input.label,
    board: clone(input.board),
    createdAt: new Date(),
  };
  snapshots.set(snapshot.id, snapshot);
  return clone(snapshot);
}

export function deleteSnapshot(
  scenarioId: number,
  snapshotId: number,
): boolean {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot || snapshot.scenarioId !== scenarioId) return false;
  return snapshots.delete(snapshotId);
}
