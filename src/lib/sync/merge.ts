import type { SyncState } from "@/lib/data/types";

/** Fields the conflict rule looks at. One row per table name plus id. */
export interface SyncRecord {
  table: string;
  id: string;
  updatedAt: string;
  rev: number;
  deletedAt: string | null;
  syncState: SyncState;
  updatedBy?: string;
}

/** Remote wins only when its edit is strictly newer. Equal rows stay local so an unsent edit is not dropped. */
export function remoteWins(local: Pick<SyncRecord, "updatedAt" | "rev">, remote: Pick<SyncRecord, "updatedAt" | "rev">): boolean {
  if (remote.updatedAt !== local.updatedAt) return remote.updatedAt > local.updatedAt;
  return remote.rev > local.rev;
}

export function recordKey(row: Pick<SyncRecord, "table" | "id">): string {
  return `${row.table}\u0000${row.id}`;
}

/**
 * Merge by table and id. Incoming rows that win are marked synced.
 * A local row that wins keeps its sync state, including a pending edit or tombstone.
 */
export function mergeRecords(local: SyncRecord[], remote: SyncRecord[]): SyncRecord[] {
  const map = new Map<string, SyncRecord>();
  for (const row of local) map.set(recordKey(row), row);
  for (const row of remote) {
    const key = recordKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, syncState: "synced" });
      continue;
    }
    if (remoteWins(existing, row)) {
      map.set(key, { ...row, syncState: "synced" });
    }
  }
  return [...map.values()];
}

/** Anything not yet accepted by the server still needs a push. */
export function outboundQueue(rows: SyncRecord[]): SyncRecord[] {
  return rows.filter((row) => row.syncState !== "synced");
}

/** A failed push leaves the queue untouched. */
export function keepQueueAfterFailure(rows: SyncRecord[]): SyncRecord[] {
  return rows.map((row) => ({ ...row }));
}

/** Mark only the rows the server accepted. */
export function markPushed(rows: SyncRecord[], pushed: Array<Pick<SyncRecord, "table" | "id">>, updatedBy?: string): SyncRecord[] {
  const keys = new Set(pushed.map(recordKey));
  return rows.map((row) => (keys.has(recordKey(row)) ? { ...row, syncState: "synced", updatedBy: updatedBy ?? row.updatedBy } : row));
}
