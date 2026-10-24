import type { ChangeLogEntry } from "@/lib/data/types";

/**
 * Seam for a future cloud sync service.
 *
 * v1 uses LocalOnlySync. A backend would:
 * 1. Read ChangeLogEntry rows with entity rev greater than the server's.
 * 2. Upsert the matching records (projects, reports, tasks, estimates, files).
 * 3. Set syncState to "synced" on accepted rows.
 * 4. Pull other users' changes and merge by (entity, entityId, rev).
 *
 * Team accounts belong with that service. They are not in the local database.
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
