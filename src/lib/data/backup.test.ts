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
    const project = await saveProject(blankProject({ name: "Findley State Park", jobNumber: "26194" }));
    const blob = new Blob(["drive note"], { type: "application/pdf" });
    await saveAttachment(
      blankAttachment(project.id, {
        fileName: "Drive-note.pdf",
        mimeType: "application/pdf",
        blob,
      }),
    );

    const backup = await exportBackup();
    expect(backup.app).toBe("wire-chief");
    expect(backup.version).toBe(1);
    expect(backup.projects.map((item) => item.name)).toEqual(["Findley State Park"]);
    expect(backup.attachments[0]?.dataBase64).toBe(btoa("drive note"));

    await saveProject(blankProject({ name: "Other job" }));
    await importBackup(backup);

    const restored = await getProject(project.id);
    expect(restored?.jobNumber).toBe("26194");
    expect(await db.projects.filter((item) => item.name === "Other job").count()).toBe(0);
    const file = await db.attachments.where("projectId").equals(project.id).first();
    expect(await file?.blob.text()).toBe("drive note");
  });

  it("rejects a file that is not a Wire Chief backup", async () => {
    await expect(importBackup({ app: "other", version: 1 } as never)).rejects.toThrow(/not a Wire Chief backup/);
  });
});
