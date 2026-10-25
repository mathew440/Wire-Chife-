import { exportBackup, importBackup, importJob } from "@/lib/data/backup";
import { db } from "@/lib/data/db";
import { blankLaborBudget, blankOrder, blankProject, blankTimeEntry, defaultSettings } from "@/lib/data/factories";
import { deleteProject, getProject, listLaborBudgets, listOrders, listProjects, listTimeEntries, saveLaborBudget, saveOrder, saveProject, saveTimeEntry } from "@/lib/data/repo";
import { resetSeedGate } from "@/lib/data/seed";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("orders and hours backup", () => {
  it("imports a version-1 file that has no orders or hours", async () => {
    const project = blankProject({ id: "sample-job-a", name: "Sample Job A", jobNumber: "1001" });
    await importBackup({
      app: "wire-chief",
      version: 1,
      exportedAt: "2026-10-23T12:00:00.000Z",
      settings: defaultSettings(),
      projects: [project],
      people: [],
      assignments: [],
      reports: [],
      tasks: [],
      estimates: [],
      schedule: [],
      attachments: [],
      changelog: [],
    });
    expect((await getProject(project.id))?.name).toBe("Sample Job A");
    expect(await db.orders.count()).toBe(0);
    expect(await db.laborBudgets.count()).toBe(0);
    expect(await db.timeEntries.count()).toBe(0);
    expect((await exportBackup()).version).toBe(1);
  });

  it("adds one job's orders and hours without removing the other job", async () => {
    const kept = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001" }));
    const source = await saveProject(blankProject({ name: "Sample Job B", jobNumber: "1002" }));
    await saveOrder(
      blankOrder(source.id, {
        description: "Panel",
        vendor: "Sample Supply",
        quantity: "2",
        status: "ordered",
        expectedDate: "2026-10-28",
        poNumber: "PO-10",
      }),
    );
    await saveLaborBudget(blankLaborBudget(source.id, { label: "Total", allowedHours: 40 }));
    await saveTimeEntry(blankTimeEntry(source.id, { date: "2026-10-22", hours: 8, workerName: "Alex", note: "Rough-in" }));
    const backup = await exportBackup();
    expect(backup.orders?.map((row) => row.description)).toEqual(["Panel"]);
    expect(backup.laborBudgets?.[0]?.allowedHours).toBe(40);
    expect(backup.timeEntries?.[0]?.hours).toBe(8);
    await deleteProject(source.id);
    await saveProject(blankProject({ name: "Sample Job C" }));

    await importJob(backup, source.id);

    expect((await listProjects()).map((project) => project.name).sort()).toEqual(["Sample Job A", "Sample Job B", "Sample Job C"]);
    expect((await getProject(kept.id))?.jobNumber).toBe("1001");
    expect((await listOrders(source.id))[0]?.poNumber).toBe("PO-10");
    expect((await listLaborBudgets(source.id))[0]?.label).toBe("Total");
    expect((await listTimeEntries(source.id))[0]?.note).toBe("Rough-in");
    expect(await listOrders(kept.id)).toEqual([]);
  });

  it("removes orders and hours when that job is deleted", async () => {
    const project = await saveProject(blankProject({ name: "Sample Job A" }));
    const other = await saveProject(blankProject({ name: "Sample Job B" }));
    await saveOrder(blankOrder(project.id, { description: "Wire" }));
    await saveLaborBudget(blankLaborBudget(project.id, { allowedHours: 10 }));
    await saveTimeEntry(blankTimeEntry(project.id, { hours: 4, date: "2026-10-24" }));
    await saveOrder(blankOrder(other.id, { description: "Gear" }));

    await deleteProject(project.id);

    expect(await listOrders(project.id)).toEqual([]);
    expect(await listLaborBudgets(project.id)).toEqual([]);
    expect(await listTimeEntries(project.id)).toEqual([]);
    expect((await listOrders(other.id)).map((row) => row.description)).toEqual(["Gear"]);
  });
});
