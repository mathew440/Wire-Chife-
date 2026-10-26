import type { ChangeLogEntry } from "@/lib/data/types";

/**
 * Older seam kept so a caller can still name the local adapter.
 * Signed-in sync lives in src/lib/sync/engine.ts. It upserts whole records,
 * pulls by the server clock, and merges by updatedAt then rev.
 */
export interface SyncAdapter {
  readonly id: "local-only" | "cloud";
  push(changes: ChangeLogEntry[]): Promise<void>;
  pull(sinceIso: string): Promise<ChangeLogEntry[]>;
}

export const localOnlySync: SyncAdapter = {
  id: "local-only",
  async push() {
    return;
  },
  async pull() {
    return [];
  },
};
