import { db } from "@/lib/data/db";
import { getSettings, listAllEstimates, listAllReports, listAssignments, listPeople, listProjects, listTasks } from "@/lib/data/repo";
import { DRIVE_IDS, ensureSeeded, resetSeedGate } from "@/lib/data/seed";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("Drive seed as of 10/23/26", () => {
  it("loads only Findley and St. Peter, with no invented report, hours, or prices", async () => {
    await ensureSeeded();
    const projects = await listProjects();
    expect(projects.map((project) => project.name).sort()).toEqual(["Findley State Park", "St. Peter Church"]);

    const findley = projects.find((project) => project.id === DRIVE_IDS.findley);
    const peter = projects.find((project) => project.id === DRIVE_IDS.peter);
    expect(findley?.jobNumber).toBe("26194");
    expect(findley?.status).toBe("unverified");
    expect(findley?.description).toContain("119 pads");
    expect(findley?.description).toContain("needs verification");
    expect(peter?.jobNumber).toBe("");
    expect(peter?.description).toContain("Schedule #9-1");
    expect(peter?.status).toBe("unverified");

    expect(await listAllReports()).toEqual([]);
    expect(await listAllEstimates()).toEqual([]);
    expect(await listAssignments()).toEqual([]);

    const tasks = await listTasks(DRIVE_IDS.findley);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.status === "open" && task.dueDate == null)).toBe(true);
    expect(tasks.some((task) => task.title.includes("340 vs 354"))).toBe(true);
    expect(tasks.some((task) => task.owner === "Mat Hiner" && task.title === "Tugger")).toBe(true);

    const mat = (await listPeople()).find((person) => person.id === DRIVE_IDS.mat);
    expect(mat?.classification).toBe("Project Manager");
    const settings = await getSettings();
    expect(settings.profileName).toBe("Mat Hiner");
    expect(settings.profileRole).toBe("Project Manager");
    expect(settings.foremanName).toBe("");
  });
});
