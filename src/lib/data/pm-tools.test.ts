import { exportBackup, importBackup, importJob } from "@/lib/data/backup";
import { db } from "@/lib/data/db";
import { blankAttachment, blankLogItem, blankProject, blankSchedule } from "@/lib/data/factories";
import { deleteProject, getProject, listLogItems, listProjects, saveAttachment, saveLogItem, saveProject, saveSchedule } from "@/lib/data/repo";
import { resetSeedGate } from "@/lib/data/seed";
import type { ScheduleDate } from "@/lib/data/types";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("submittals, photos, and one-job import", () => {
  it("keeps a submittal on its job and removes it when that job is deleted", async () => {
    const project = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001" }));
    const other = await saveProject(blankProject({ name: "Sample Job B", jobNumber: "1002" }));
    await saveLogItem(
      blankLogItem(project.id, "submittal", { number: "S-1", description: "Panel schedule", status: "submitted" }),
    );
    await saveLogItem(blankLogItem(other.id, "rfi", { number: "R-1", description: "Fixture" }));
    expect((await listLogItems(project.id)).map((item) => item.number)).toEqual(["S-1"]);
    await deleteProject(project.id);
    expect(await listLogItems(project.id)).toEqual([]);
    expect((await listLogItems(other.id)).map((item) => item.number)).toEqual(["R-1"]);
  });

  it("stores a photo on the job and round-trips it in a version-1 backup", async () => {
    const project = await saveProject(blankProject({ name: "Sample Job A" }));
    await saveAttachment(
      blankAttachment(project.id, {
        parentType: "photo",
        parentId: project.id,
        fileName: "area.jpg",
        mimeType: "image/jpeg",
        blob: new Blob(["photo-bytes"], { type: "image/jpeg" }),
        area: "Electrical room",
        caption: "Panel wall",
        takenDate: "2026-10-24",
      }),
    );
    const backup = await exportBackup();
    expect(backup.version).toBe(1);
    expect(backup.attachments[0]?.caption).toBe("Panel wall");
    expect(backup.attachments[0]?.area).toBe("Electrical room");
    await db.delete();
    await db.open();
    await importBackup(backup);
    const restored = await db.attachments.where("projectId").equals(project.id).first();
    expect(restored?.parentType).toBe("photo");
    expect(restored?.caption).toBe("Panel wall");
    expect(await restored?.blob.text()).toBe("photo-bytes");
  });

  it("imports one job from a backup without removing the other job", async () => {
    const kept = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001" }));
    const source = await saveProject(
      blankProject({
        name: "Sample Job B",
        jobNumber: "1002",
        contacts: [{ id: "c1", name: "Alex", role: "Super", phone: "", email: "alex@example.com", company: "Sample GC" }],
      }),
    );
    await saveSchedule(blankSchedule(source.id, { label: "Inspection", date: "2026-10-24", endDate: "2026-10-30", confirmation: "needs-verification", source: "Call", asOf: "2026-10-24" }));
    await saveLogItem(blankLogItem(source.id, "rfi", { number: "R-9", description: "Conduit route", ballInCourt: "Alex", contactId: "c1" }));
    const backup = await exportBackup();
    await saveProject(blankProject({ name: "Sample Job C" }));
    await deleteProject(source.id);

    await importJob(backup, source.id);

    const names = (await listProjects()).map((project) => project.name).sort();
    expect(names).toEqual(["Sample Job A", "Sample Job B", "Sample Job C"]);
    expect((await getProject(kept.id))?.jobNumber).toBe("1001");
    const imported = await getProject(source.id);
    expect(imported?.contacts[0]?.company).toBe("Sample GC");
    expect(imported?.contacts[0]?.email).toBe("alex@example.com");
    expect((await listLogItems(source.id))[0]?.number).toBe("R-9");
    const date = await db.schedule.where("projectId").equals(source.id).first();
    expect(date?.endDate).toBe("2026-10-30");
    expect(date?.confirmation).toBe("needs-verification");
  });

  it("still imports a version-1 file that has no log and marks the starter book loaded", async () => {
    const { defaultSettings } = await import("@/lib/data/factories");
    const { DRIVE_SEED_REVISION } = await import("@/lib/data/seed");
    const project = blankProject({ id: "sample-job-a", name: "Sample Job A", jobNumber: "1001", isSample: true });
    const settings = { ...defaultSettings(), samplesSeeded: true, seedRevision: DRIVE_SEED_REVISION };
    await importBackup({
      app: "wire-chief",
      version: 1,
      exportedAt: "2026-10-23T12:00:00.000Z",
      settings,
      projects: [project],
      people: [],
      assignments: [],
      reports: [],
      tasks: [],
      estimates: [],
      schedule: [{ ...blankSchedule(project.id, { label: "Delivery", date: "2026-10-28" }), endDate: undefined } as unknown as ScheduleDate],
      attachments: [],
      changelog: [],
    });
    expect((await getProject(project.id))?.name).toBe("Sample Job A");
    expect(await db.logItems.count()).toBe(0);
    expect((await db.settings.get("local"))?.samplesSeeded).toBe(true);
    expect((await db.settings.get("local"))?.seedRevision).toBe(DRIVE_SEED_REVISION);
    const schedule = await db.schedule.toArray();
    expect(schedule[0]?.date).toBe("2026-10-28");
  });
});
