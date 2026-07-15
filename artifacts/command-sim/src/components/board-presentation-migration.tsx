import { useEffect } from "react";
import {
  boardNeedsPresentationMigration,
  normalizeBoardPresentation,
  useBoardStore,
} from "@/lib/game";

const AUTOSAVE_KEY = "nordlys-command:autosave";

export function BoardPresentationMigration() {
  const board = useBoardStore(state => state.board);

  useEffect(() => {
    if (!boardNeedsPresentationMigration(board)) return;
    const normalized = normalizeBoardPresentation(board);
    useBoardStore.setState({ board: normalized });
    try {
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ board: normalized, savedAt: new Date().toISOString() }),
      );
    } catch {
      // Migration remains usable when browser storage is unavailable.
    }
  }, [board]);

  return null;
}
