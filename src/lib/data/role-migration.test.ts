import { db } from "@/lib/data/db";
import { blankPerson, defaultSettings } from "@/lib/data/factories";
import { getSettings, savePerson, saveSettings } from "@/lib/data/repo";
import { migrateSeededProjectManager } from "@/lib/data/role-migration";
import { SEEDED_MAT_ID, SEEDED_OLD_ROLE, SEEDED_PROFILE_NAME, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import { resetSeedGate } from "@/lib/data/seed";
import type { Settings } from "@/lib/data/types";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

async function putOldSettings(partial: Partial<Settings> = {}): Promise<void> {
  const settings = defaultSettings();
  const stored = { ...settings, ...partial } as Settings;
  delete (stored as Partial<Settings>).profileRole;
  delete (stored as Partial<Settings>).foremanName;
  delete (stored as Partial<Settings>).seededRoleMigrated;
  await db.settings.put(stored);
}

describe("seeded project manager migration", () => {
  it("changes the seeded Foreman classification and leaves the foreman name blank", async () => {
    await db.people.put(
      blankPerson({
        id: SEEDED_MAT_ID,
        name: SEEDED_PROFILE_NAME,
        classification: SEEDED_OLD_ROLE,
        phone: "",
        isSample: false,
      }),
    );
    await putOldSettings();

    await migrateSeededProjectManager();

    const person = await db.people.get(SEEDED_MAT_ID);
    const settings = await getSettings();
    expect(person?.classification).toBe(SEEDED_PROFILE_ROLE);
    expect(settings.profileRole).toBe(SEEDED_PROFILE_ROLE);
    expect(settings.foremanName).toBe("");
    expect(settings.seededRoleMigrated).toBe(true);
  });

  it("does not change a seeded person whose role is no longer Foreman", async () => {
    await db.people.put(
      blankPerson({
        id: SEEDED_MAT_ID,
        name: SEEDED_PROFILE_NAME,
        classification: "Superintendent",
        isSample: false,
      }),
    );
    await putOldSettings();
    await db.settings.update("local", { profileRole: "Superintendent", foremanName: "Riley" } as Partial<Settings>);

    await migrateSeededProjectManager();

    const person = await db.people.get(SEEDED_MAT_ID);
    const settings = await getSettings();
    expect(person?.classification).toBe("Superintendent");
    expect(settings.profileRole).toBe("Superintendent");
    expect(settings.foremanName).toBe("Riley");
  });

  it("does not change a Foreman who is not the seeded Mat Hiner row", async () => {
    await db.people.put(
      blankPerson({
        id: SEEDED_MAT_ID,
        name: "Pat Lee",
        classification: SEEDED_OLD_ROLE,
        isSample: false,
      }),
    );
    await putOldSettings();

    await migrateSeededProjectManager();

    expect((await db.people.get(SEEDED_MAT_ID))?.classification).toBe(SEEDED_OLD_ROLE);
  });

  it("runs once, so a later edit back to Foreman stays", async () => {
    await db.people.put(
      blankPerson({
        id: SEEDED_MAT_ID,
        name: SEEDED_PROFILE_NAME,
        classification: SEEDED_OLD_ROLE,
        isSample: false,
      }),
    );
    await putOldSettings();
    await migrateSeededProjectManager();
    await savePerson({
      ...(await db.people.get(SEEDED_MAT_ID))!,
      classification: SEEDED_OLD_ROLE,
    });
    await saveSettings({ ...(await getSettings()), profileRole: SEEDED_OLD_ROLE });

    await migrateSeededProjectManager();

    expect((await db.people.get(SEEDED_MAT_ID))?.classification).toBe(SEEDED_OLD_ROLE);
    expect((await getSettings()).profileRole).toBe(SEEDED_OLD_ROLE);
  });
});
