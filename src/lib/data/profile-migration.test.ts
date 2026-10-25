import { db } from "@/lib/data/db";
import { blankProject, defaultSettings } from "@/lib/data/factories";
import { migrateProfileContact } from "@/lib/data/profile-migration";
import { getProject, getSettings, saveProject, saveSettings } from "@/lib/data/repo";
import { SEEDED_COMPANY_NAME, SEEDED_PROFILE_EMAIL } from "@/lib/data/roles";
import { resetSeedGate } from "@/lib/data/seed";
import type { Settings } from "@/lib/data/types";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("profile company and email", () => {
  it("fills a blank company and email once and leaves a typed profile and other jobs", async () => {
    await saveProject(blankProject({ id: "sample-job-a", name: "Sample Job A", jobNumber: "1001" }));

    const blank = {
      ...defaultSettings(),
      profileName: "Pat Lee",
      profileRole: "Superintendent",
      companyName: "",
      profileContactMigrated: false,
    } as Settings;
    delete (blank as Partial<Settings>).profileEmail;
    await db.settings.put(blank);

    await migrateProfileContact();

    let settings = await getSettings();
    expect(settings.profileName).toBe("Pat Lee");
    expect(settings.profileRole).toBe("Superintendent");
    expect(settings.companyName).toBe(SEEDED_COMPANY_NAME);
    expect(settings.profileEmail).toBe(SEEDED_PROFILE_EMAIL);
    expect((await getProject("sample-job-a"))?.name).toBe("Sample Job A");

    await saveSettings({ ...settings, companyName: "Northwind Electric", profileEmail: "pm@example.com" });
    await migrateProfileContact();
    settings = await getSettings();
    expect(settings.companyName).toBe("Northwind Electric");
    expect(settings.profileEmail).toBe("pm@example.com");

    await db.settings.put({
      ...settings,
      companyName: "AKA Electric",
      profileEmail: "boss@example.com",
      profileContactMigrated: false,
    });
    await migrateProfileContact();
    settings = await getSettings();
    expect(settings.companyName).toBe("AKA Electric Inc");
    expect(settings.profileEmail).toBe("boss@example.com");
    expect((await getProject("sample-job-a"))?.jobNumber).toBe("1001");
  });
});
