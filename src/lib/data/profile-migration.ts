import { db } from "@/lib/data/db";
import { saveSettings } from "@/lib/data/repo";
import {
  PREVIOUS_COMPANY_NAME,
  SEEDED_COMPANY_NAME,
  SEEDED_PROFILE_EMAIL,
  SEEDED_PROFILE_NAME,
  SEEDED_PROFILE_ROLE,
} from "@/lib/data/roles";
import type { Settings } from "@/lib/data/types";

type StoredSettings = Settings & {
  profileName?: string;
  profileRole?: string;
  companyName?: string;
  profileEmail?: string;
  profileContactMigrated?: boolean;
};

/**
 * Fill a blank name, title, company, or email once. The previous built-in
 * company "AKA Electric" is the old placeholder, so that exact value becomes
 * "AKA Electric Inc". Any other company or email is left as saved.
 */
export async function migrateProfileContact(): Promise<void> {
  const raw = (await db.settings.get("local")) as StoredSettings | undefined;
  if (!raw || raw.deletedAt || raw.profileContactMigrated) return;

  const name = typeof raw.profileName === "string" ? raw.profileName.trim() : "";
  const role = typeof raw.profileRole === "string" ? raw.profileRole.trim() : "";
  const company = typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  const email = typeof raw.profileEmail === "string" ? raw.profileEmail.trim() : "";

  await saveSettings({
    ...raw,
    profileName: name || SEEDED_PROFILE_NAME,
    profileRole: role || SEEDED_PROFILE_ROLE,
    companyName: !company || company === PREVIOUS_COMPANY_NAME ? SEEDED_COMPANY_NAME : company,
    profileEmail: email || SEEDED_PROFILE_EMAIL,
    profileContactMigrated: true,
  });
}
