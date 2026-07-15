import { useEffect } from "react";
import {
  WORKSPACE_UPDATED_EVENT,
  loadWorkspaceState,
  saveWorkspaceState,
  type UserWorkspaceState,
  type WorkspaceAsset,
} from "@/lib/workspace";

interface ServerWorkspaceAsset extends WorkspaceAsset {
  updatedAt?: string;
}

/**
 * Synchronizes the browser workspace asset catalog with the authenticated
 * server-side account catalog. Source bytes remain in the validated asset
 * storage; only metadata is synchronized here.
 */
export function WorkspaceAssetSync() {
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const knownServerIds = new Set<string>();

    const pullAndPush = async (stateInput?: UserWorkspaceState) => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const response = await fetch("/api/workspace/assets", { credentials: "include" });
        if (!response.ok) return;
        const body = await response.json() as { assets?: ServerWorkspaceAsset[] };
        const remote = Array.isArray(body.assets) ? body.assets : [];
        remote.forEach(asset => knownServerIds.add(asset.id));

        const current = stateInput ?? loadWorkspaceState();
        const merged = mergeAssets(current.assets, remote);
        if (!sameAssetIds(current.assets, merged)) {
          saveWorkspaceState({ ...current, assets: merged });
        }

        for (const asset of merged) {
          if (knownServerIds.has(asset.id)) continue;
          const create = await fetch("/api/workspace/assets", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(asset),
          });
          if (create.ok) knownServerIds.add(asset.id);
        }
      } finally {
        busy = false;
      }
    };

    const onWorkspaceUpdated = (event: Event) => {
      const custom = event as CustomEvent<UserWorkspaceState>;
      void pullAndPush(custom.detail ?? loadWorkspaceState());
    };
    const onFocus = () => void pullAndPush();

    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void pullAndPush(), 30_000);
    void pullAndPush();

    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

function mergeAssets(local: WorkspaceAsset[], remote: ServerWorkspaceAsset[]): WorkspaceAsset[] {
  const byId = new Map<string, WorkspaceAsset>();
  for (const asset of remote) byId.set(asset.id, stripServerFields(asset));
  for (const asset of local) byId.set(asset.id, asset);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function stripServerFields(asset: ServerWorkspaceAsset): WorkspaceAsset {
  return {
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    sourceId: asset.sourceId,
    sourceUrl: asset.sourceUrl,
    origin: asset.origin,
    createdAt: asset.createdAt,
  };
}

function sameAssetIds(first: WorkspaceAsset[], second: WorkspaceAsset[]): boolean {
  return first.length === second.length && first.every((asset, index) => asset.id === second[index]?.id);
}
