import { db } from "@/lib/data/db";
import { savePerson, saveSettings } from "@/lib/data/repo";
import { SEEDED_MAT_ID, SEEDED_OLD_ROLE, SEEDED_PROFILE_NAME, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import type { Settings } from "@/lib/data/types";

type StoredSettings = Settings & {
  profileRole?: string;
  foremanName?: string;
  seededRoleMigrated?: boolean;
};

/**
 * Existing phones keep IndexedDB from the first seed, where Mat Hiner was
 * classified as Foreman. Upgrade that seeded row once. A renamed person or a
 * classification the user already changed is left alone.
 */
export async function migrateSeededProjectManager(): Promise<void> {
  const raw = (await db.settings.get("local")) as StoredSettings | undefined;
  if (raw?.seededRoleMigrated) return;

  const person = await db.people.get(SEEDED_MAT_ID);
  if (
    person &&
    !person.deletedAt &&
    person.name === SEEDED_PROFILE_NAME &&
    person.classification === SEEDED_OLD_ROLE
  ) {
    await savePerson({ ...person, classification: SEEDED_PROFILE_ROLE });
  }

  if (!raw || raw.deletedAt) return;
  const profileRole = typeof raw.profileRole === "string" ? raw.profileRole.trim() : "";
  await saveSettings({
    ...raw,
    profileRole: profileRole || SEEDED_PROFILE_ROLE,
    foremanName: typeof raw.foremanName === "string" ? raw.foremanName : "",
    seededRoleMigrated: true,
  });
}
