// Zustand store powering the tactical command board: entities, zones, layers,
// phases, timeline, undo/redo history, selection, and autosave to localStorage.

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  BoardEntity,
  BoardLayer,
  BoardState,
  BoardZone,
  Faction,
  MoveLogEntry,
  ScenarioPhase,
  TimelineEvent,
  TimelineEventSeverity,
} from "./types";
import { createEmptyBoard, DEFAULT_ATTRIBUTES } from "./types";
import { getEntityTemplate } from "./entityCatalog";

const AUTOSAVE_KEY = "nordlys-command:autosave";
const HISTORY_LIMIT = 60;

interface HistorySnapshot {
  board: BoardState;
}

interface BoardStoreState {
  board: BoardState;
  scenarioId: number | null;
  scenarioName: string;
  scenarioDescription: string;
  selectedIds: string[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // lifecycle
  loadBoard: (board: BoardState, scenarioId: number | null, name: string, description: string) => void;
  resetToEmpty: (mapTemplateId: string) => void;
  restoreAutosave: () => boolean;

  // entities
  addEntity: (templateId: string, x: number, y: number) => string;
  updateEntity: (id: string, patch: Partial<BoardEntity>) => void;
  removeEntities: (ids: string[]) => void;
  duplicateEntities: (ids: string[]) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;

  // zones
  addZone: (zone: Omit<BoardZone, "id">) => string;
  updateZone: (id: string, patch: Partial<BoardZone>) => void;
  removeZone: (id: string) => void;

  // layers
  addLayer: (name: string) => string;
  updateLayer: (id: string, patch: Partial<BoardLayer>) => void;
  removeLayer: (id: string) => void;

  // phases & timeline
  addPhase: (name: string, description: string) => string;
  setCurrentPhase: (id: string) => void;
  removePhase: (id: string) => void;
  addTimelineEvent: (label: string, description: string, severity: TimelineEventSeverity) => void;
  logMove: (summary: string, actorFaction: Faction | null) => void;

  // selection & history
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;

  // meta
  setNotes: (notes: string) => void;
  setScenarioMeta: (name: string, description: string) => void;
}

function pushHistory(state: BoardStoreState): Pick<BoardStoreState, "past" | "future"> {
  const snapshot: HistorySnapshot = { board: state.board };
  const past = [...state.past, snapshot].slice(-HISTORY_LIMIT);
  return { past, future: [] };
}

function autosave(board: BoardState) {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ board, savedAt: new Date().toISOString() }));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export const useBoardStore = create<BoardStoreState>((set, get) => ({
  board: createEmptyBoard("custom"),
  scenarioId: null,
  scenarioName: "Untitled Scenario",
  scenarioDescription: "",
  selectedIds: [],
  past: [],
  future: [],

  loadBoard: (board, scenarioId, name, description) => {
    set({ board, scenarioId, scenarioName: name, scenarioDescription: description, past: [], future: [], selectedIds: [] });
    autosave(board);
  },

  resetToEmpty: (mapTemplateId) => {
    const board = createEmptyBoard(mapTemplateId);
    set({ board, scenarioId: null, scenarioName: "Untitled Scenario", scenarioDescription: "", past: [], future: [], selectedIds: [] });
    autosave(board);
  },

  restoreAutosave: () => {
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { board: BoardState };
      if (!parsed?.board) return false;
      set({ board: parsed.board, past: [], future: [], selectedIds: [] });
      return true;
    } catch {
      return false;
    }
  },

  addEntity: (templateId, x, y) => {
    const template = getEntityTemplate(templateId);
    if (!template) return "";
    const id = nanoid(10);
    const state = get();
    const activeLayer = state.board.layers.find((l) => l.visible && !l.locked) ?? state.board.layers[0];
    const entity: BoardEntity = {
      id,
      templateId,
      category: template.category,
      faction: template.faction,
      label: template.label,
      x,
      y,
      rotation: 0,
      scale: template.defaultScale,
      zIndex: state.board.entities.length,
      layerId: activeLayer?.id ?? "layer-default",
      zoneId: null,
      groupId: null,
      locked: false,
      attributes: { ...DEFAULT_ATTRIBUTES, ...template.defaultAttributes },
      notes: "",
    };
    set((s) => ({
      ...pushHistory(s),
      board: { ...s.board, entities: [...s.board.entities, entity] },
      selectedIds: [id],
    }));
    autosave(get().board);
    return id;
  },

  updateEntity: (id, patch) => {
    set((s) => ({
      ...pushHistory(s),
      board: {
        ...s.board,
        entities: s.board.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    }));
    autosave(get().board);
  },

  removeEntities: (ids) => {
    const idSet = new Set(ids);
    set((s) => ({
      ...pushHistory(s),
      board: { ...s.board, entities: s.board.entities.filter((e) => !idSet.has(e.id)) },
      selectedIds: s.selectedIds.filter((id) => !idSet.has(id)),
    }));
    autosave(get().board);
  },

  duplicateEntities: (ids) => {
    const idSet = new Set(ids);
    const newIds: string[] = [];
    set((s) => {
      const clones = s.board.entities
        .filter((e) => idSet.has(e.id))
        .map((e) => {
          const newId = nanoid(10);
          newIds.push(newId);
          return { ...e, id: newId, x: e.x + 24, y: e.y + 24, groupId: null };
        });
      return {
        ...pushHistory(s),
        board: { ...s.board, entities: [...s.board.entities, ...clones] },
        selectedIds: newIds,
      };
    });
    autosave(get().board);
  },

  groupSelected: () => {
    const groupId = nanoid(8);
    set((s) => ({
      ...pushHistory(s),
      board: {
        ...s.board,
        entities: s.board.entities.map((e) =>
          s.selectedIds.includes(e.id) ? { ...e, groupId } : e,
        ),
      },
    }));
    autosave(get().board);
  },

  ungroupSelected: () => {
    set((s) => ({
      ...pushHistory(s),
      board: {
        ...s.board,
        entities: s.board.entities.map((e) =>
          s.selectedIds.includes(e.id) ? { ...e, groupId: null } : e,
        ),
      },
    }));
    autosave(get().board);
  },

  addZone: (zone) => {
    const id = nanoid(10);
    set((s) => ({
      ...pushHistory(s),
      board: { ...s.board, zones: [...s.board.zones, { ...zone, id }] },
    }));
    autosave(get().board);
    return id;
  },

  updateZone: (id, patch) => {
    set((s) => ({
      ...pushHistory(s),
      board: { ...s.board, zones: s.board.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) },
    }));
    autosave(get().board);
  },

  removeZone: (id) => {
    set((s) => ({
      ...pushHistory(s),
      board: {
        ...s.board,
        zones: s.board.zones.filter((z) => z.id !== id),
        entities: s.board.entities.map((e) => (e.zoneId === id ? { ...e, zoneId: null } : e)),
      },
    }));
    autosave(get().board);
  },

  addLayer: (name) => {
    const id = nanoid(8);
    set((s) => ({
      board: {
        ...s.board,
        layers: [...s.board.layers, { id, name, visible: true, locked: false, order: s.board.layers.length }],
      },
    }));
    autosave(get().board);
    return id;
  },

  updateLayer: (id, patch) => {
    set((s) => ({
      board: { ...s.board, layers: s.board.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) },
    }));
    autosave(get().board);
  },

  removeLayer: (id) => {
    set((s) => {
      if (s.board.layers.length <= 1) return s;
      return {
        board: {
          ...s.board,
          layers: s.board.layers.filter((l) => l.id !== id),
          entities: s.board.entities.map((e) =>
            e.layerId === id ? { ...e, layerId: s.board.layers[0].id } : e,
          ),
        },
      };
    });
    autosave(get().board);
  },

  addPhase: (name, description) => {
    const id = nanoid(8);
    set((s) => ({
      board: {
        ...s.board,
        phases: [...s.board.phases, { id, name, description, order: s.board.phases.length }],
      },
    }));
    autosave(get().board);
    return id;
  },

  setCurrentPhase: (id) => {
    set((s) => ({ board: { ...s.board, currentPhaseId: id } }));
    autosave(get().board);
  },

  removePhase: (id) => {
    set((s) => ({
      board: {
        ...s.board,
        phases: s.board.phases.filter((p) => p.id !== id),
        currentPhaseId: s.board.currentPhaseId === id ? (s.board.phases[0]?.id ?? null) : s.board.currentPhaseId,
      },
    }));
    autosave(get().board);
  },

  addTimelineEvent: (label, description, severity) => {
    const event: TimelineEvent = {
      id: nanoid(10),
      phaseId: get().board.currentPhaseId,
      label,
      description,
      severity,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ board: { ...s.board, timelineEvents: [...s.board.timelineEvents, event] } }));
    autosave(get().board);
  },

  logMove: (summary, actorFaction) => {
    const entry: MoveLogEntry = {
      id: nanoid(10),
      summary,
      actorFaction,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ board: { ...s.board, moveHistory: [...s.board.moveHistory, entry] } }));
    autosave(get().board);
  },

  setSelection: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),

  undo: () => {
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      const newPast = s.past.slice(0, -1);
      return {
        board: previous.board,
        past: newPast,
        future: [{ board: s.board }, ...s.future].slice(0, HISTORY_LIMIT),
      };
    });
    autosave(get().board);
  },

  redo: () => {
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      const newFuture = s.future.slice(1);
      return {
        board: next.board,
        past: [...s.past, { board: s.board }].slice(-HISTORY_LIMIT),
        future: newFuture,
      };
    });
    autosave(get().board);
  },

  setNotes: (notes) => {
    set((s) => ({ board: { ...s.board, notes } }));
    autosave(get().board);
  },

  setScenarioMeta: (name, description) => set({ scenarioName: name, scenarioDescription: description }),
}));

export function readAutosaveTimestamp(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: string };
    return parsed?.savedAt ?? null;
  } catch {
    return null;
  }
}
