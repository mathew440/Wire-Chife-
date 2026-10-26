export type SyncPhase = "needs-sign-in" | "offline" | "syncing" | "synced";

export interface SyncSnapshot {
  /** False until the saved session has been read. */
  ready: boolean;
  phase: SyncPhase;
  email: string | null;
  lastError: string | null;
  askUpload: boolean;
}

const listeners = new Set<() => void>();

let snapshot: SyncSnapshot = {
  ready: false,
  phase: "needs-sign-in",
  email: null,
  lastError: null,
  askUpload: false,
};

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function patchSync(partial: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  for (const listener of listeners) listener();
}

export function syncLabel(phase: SyncPhase): string {
  if (phase === "needs-sign-in") return "Needs sign-in";
  if (phase === "offline") return "Offline";
  if (phase === "syncing") return "Syncing";
  return "Synced";
}
