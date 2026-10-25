import { migrateProfileContact } from "@/lib/data/profile-migration";
import { migrateSeededProjectManager } from "@/lib/data/role-migration";
import { getSettings, saveSettings } from "@/lib/data/repo";

/**
 * Older builds wrote this value after they considered the starter book loaded.
 * Keep it so those phones and backup files are left as they are. This build
 * does not insert jobs.
 */
export const DRIVE_SEED_REVISION = "drive-2026-10-23";

let seeding: Promise<void> | null = null;

export function resetSeedGate(): void {
  seeding = null;
}

export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = seedIfNeeded()
      .then(() => migrateSeededProjectManager())
      .then(() => migrateProfileContact())
      .catch((error) => {
        seeding = null;
        throw error;
      });
  }
  return seeding;
}

async function seedIfNeeded(): Promise<void> {
  const settings = await getSettings();
  if ((settings.seedRevision ?? "") === DRIVE_SEED_REVISION) return;
  // Do not delete rows. A phone or an imported backup may already hold work.
  await saveSettings({ ...settings, seedRevision: DRIVE_SEED_REVISION });
}
