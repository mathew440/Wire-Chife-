import { exportBackup, importBackup } from "@/lib/data/backup";
import { db } from "@/lib/data/db";
import { blankAttachment, blankProject } from "@/lib/data/factories";
import { getProject, saveAttachment, saveProject } from "@/lib/data/repo";
import { resetSeedGate } from "@/lib/data/seed";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("JSON backup", () => {
  it("round-trips a job and a file, then replaces the book on import", async () => {
    const project = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001" }));
    const blob = new Blob(["sample note"], { type: "application/pdf" });
    await saveAttachment(
      blankAttachment(project.id, {
        fileName: "note.pdf",
        mimeType: "application/pdf",
        blob,
      }),
    );

    const backup = await exportBackup();
    expect(backup.app).toBe("wire-chief");
    expect(backup.version).toBe(1);
    expect(backup.projects.map((item) => item.name)).toEqual(["Sample Job A"]);
    expect(backup.attachments[0]?.dataBase64).toBe(btoa("sample note"));

    await saveProject(blankProject({ name: "Other job" }));
    await importBackup(backup);

    const restored = await getProject(project.id);
    expect(restored?.jobNumber).toBe("1001");
    expect(await db.projects.filter((item) => item.name === "Other job").count()).toBe(0);
    const file = await db.attachments.where("projectId").equals(project.id).first();
    expect(await file?.blob.text()).toBe("sample note");
  });

  it("loads a version-1 backup whose settings already mark the starter book as loaded", async () => {
    const { defaultSettings } = await import("@/lib/data/factories");
    const { ensureSeeded, DRIVE_SEED_REVISION } = await import("@/lib/data/seed");
    const project = blankProject({ id: "sample-job-a", name: "Sample Job A", jobNumber: "1001", isSample: true });
    const settings = {
      ...defaultSettings(),
      samplesSeeded: true,
      seedRevision: DRIVE_SEED_REVISION,
    };
    delete (settings as Partial<typeof settings>).profileRole;
    delete (settings as Partial<typeof settings>).foremanName;
    delete (settings as Partial<typeof settings>).seededRoleMigrated;

    const note = blankAttachment(project.id, {
      fileName: "note.pdf",
      mimeType: "application/pdf",
      blob: new Blob(["sample note"], { type: "application/pdf" }),
    });
    const storedNote = { ...note, dataBase64: btoa("sample note") };
    delete (storedNote as { blob?: Blob }).blob;

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
      schedule: [],
      attachments: [storedNote],
      changelog: [],
    });

    expect((await getProject(project.id))?.name).toBe("Sample Job A");
    const loaded = await db.settings.get("local");
    expect(loaded?.samplesSeeded).toBe(true);
    expect(loaded?.seedRevision).toBe(DRIVE_SEED_REVISION);
    expect(loaded?.profileRole).toBe("Project Manager");

    resetSeedGate();
    await ensureSeeded();
    expect((await getProject(project.id))?.jobNumber).toBe("1001");
    expect((await db.settings.get("local"))?.samplesSeeded).toBe(true);
  });

  it("rejects a file that is not a Wire Chief backup", async () => {
    await expect(importBackup({ app: "other", version: 1 } as never)).rejects.toThrow(/not a Wire Chief backup/);
  });
});
