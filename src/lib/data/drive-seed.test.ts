import { db } from "@/lib/data/db";
import { blankProject, defaultSettings } from "@/lib/data/factories";
import { getSettings, listAllEstimates, listAllReports, listAssignments, listPeople, listProjects, listTasks, saveProject, saveSettings } from "@/lib/data/repo";
import { DRIVE_SEED_REVISION, ensureSeeded, resetSeedGate } from "@/lib/data/seed";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("empty starter book", () => {
  it("opens with no jobs and the default project manager profile", async () => {
    await ensureSeeded();

    expect(await listProjects()).toEqual([]);
    expect(await listPeople()).toEqual([]);
    expect(await listAllReports()).toEqual([]);
    expect(await listAllEstimates()).toEqual([]);
    expect(await listAssignments()).toEqual([]);
    expect(await listTasks()).toEqual([]);

    const settings = await getSettings();
    expect(settings.profileName).toBe("Mat Hiner");
    expect(settings.profileRole).toBe("Project Manager");
    expect(settings.companyName).toBe("AKA Electric Inc");
    expect(settings.profileEmail).toBe("Mathew@akaelectricinc.com");
    expect(settings.foremanName).toBe("");
    expect(settings.seedRevision).toBe(DRIVE_SEED_REVISION);
    expect(settings.samplesSeeded).toBe(false);
  });

  it("does not delete jobs already stored on the device", async () => {
    await saveProject(blankProject({ id: "kept-job", name: "Sample Job A", jobNumber: "1001", isSample: true }));
    await saveSettings({ ...defaultSettings(), samplesSeeded: true, seedRevision: "" });
    resetSeedGate();

    await ensureSeeded();

    const projects = await listProjects();
    expect(projects.map((project) => project.name)).toEqual(["Sample Job A"]);
    expect(projects[0]?.jobNumber).toBe("1001");
    expect((await getSettings()).samplesSeeded).toBe(true);
  });
});
