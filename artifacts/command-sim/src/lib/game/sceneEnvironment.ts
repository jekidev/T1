import { useBoardStore } from "./boardStore";
import {
  createDefaultEnvironment,
  type BoardEnvironmentState,
  type BoardState,
} from "./types";

const AUTOSAVE_KEY = "nordlys-command:autosave";
const HISTORY_LIMIT = 60;

export function getBoardEnvironment(board: BoardState): BoardEnvironmentState {
  return { ...createDefaultEnvironment(), ...board.environment };
}

export function updateBoardEnvironment(patch: Partial<BoardEnvironmentState>): BoardEnvironmentState {
  let updated = createDefaultEnvironment();
  useBoardStore.setState(state => {
    updated = { ...getBoardEnvironment(state.board), ...patch };
    const board = { ...state.board, environment: updated };
    return {
      board,
      past: [...state.past, { board: state.board }].slice(-HISTORY_LIMIT),
      future: [],
    };
  });

  try {
    window.localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        board: useBoardStore.getState().board,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Autosave remains best-effort in private mode or when storage is full.
  }

  return updated;
}
