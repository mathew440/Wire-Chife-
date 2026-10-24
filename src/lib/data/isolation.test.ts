import { db } from "@/lib/data/db";
import { blankProject, blankReport, blankTask } from "@/lib/data/factories";
import {
  assertAttachmentParent,
  listReports,
  listTasks,
  saveAttachment,
  saveProject,
  saveReport,
  saveTask,
} from "@/lib/data/repo";
import { blankAttachment } from "@/lib/data/factories";
import { resetSeedGate } from "@/lib/data/seed";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("jobs stay separate", () => {
  it("does not show one job's report or open item on another job", async () => {
    const jobA = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001", isSample: true }));
    const jobB = await saveProject(blankProject({ name: "Sample Job B" }));
    await saveReport(blankReport(jobA.id, { needsVerification: "Scope needs verification." }));
    await saveTask(blankTask(jobA.id, { title: "Confirm the date", evidence: "Noted on this job." }));

    expect(await listReports(jobB.id)).toEqual([]);
    expect(await listTasks(jobB.id)).toEqual([]);
    expect((await listReports(jobA.id))[0]?.needsVerification).toBe("Scope needs verification.");
  });

  it("refuses to file a drawing from one job onto another", async () => {
    const jobA = await saveProject(blankProject({ name: "Sample Job A" }));
    const jobB = await saveProject(blankProject({ name: "Sample Job B" }));
    const report = await saveReport(blankReport(jobA.id, { needsVerification: "Scope needs verification." }));
    await expect(assertAttachmentParent(jobB.id, "report", report.id)).rejects.toThrow(/not on this job/);
    await expect(
      saveAttachment(
        blankAttachment(jobB.id, {
          parentType: "project",
          parentId: jobA.id,
          fileName: "cross.pdf",
          mimeType: "application/pdf",
          blob: new Blob(["nope"], { type: "application/pdf" }),
        }),
      ),
    ).rejects.toThrow(/cannot be filed/);
  });

  it("stores weather as unverified when the field is blank", async () => {
    const job = await saveProject(blankProject({ name: "Sample Job B" }));
    const saved = await saveReport(blankReport(job.id, { weatherText: "  ", weatherEntered: true }));
    expect(saved.weatherEntered).toBe(false);
    expect(saved.weatherText).toBe("");
  });

  it("refuses to mark an item done without evidence", async () => {
    const job = await saveProject(blankProject({ name: "Sample Job A" }));
    await expect(saveTask(blankTask(job.id, { title: "Close it", status: "done", evidence: "  " }))).rejects.toThrow(/evidence/i);
  });
});
