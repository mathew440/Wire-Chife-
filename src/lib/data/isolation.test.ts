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
    const findley = await saveProject(blankProject({ name: "Findley State Park", jobNumber: "26194", isSample: true }));
    const peter = await saveProject(blankProject({ name: "St. Peter Church" }));
    await saveReport(blankReport(findley.id, { needsVerification: "Pull plan needs verification." }));
    await saveTask(blankTask(findley.id, { title: "Confirm NTP", evidence: "Drive folder 26194 as of 10/23/26" }));

    expect(await listReports(peter.id)).toEqual([]);
    expect(await listTasks(peter.id)).toEqual([]);
    expect((await listReports(findley.id))[0]?.needsVerification).toBe("Pull plan needs verification.");
  });

  it("refuses to file a drawing from one job onto another", async () => {
    const findley = await saveProject(blankProject({ name: "Findley State Park" }));
    const peter = await saveProject(blankProject({ name: "St. Peter Church" }));
    const report = await saveReport(blankReport(findley.id, { needsVerification: "Scope needs verification." }));
    await expect(assertAttachmentParent(peter.id, "report", report.id)).rejects.toThrow(/not on this job/);
    await expect(
      saveAttachment(
        blankAttachment(peter.id, {
          parentType: "project",
          parentId: findley.id,
          fileName: "cross.pdf",
          mimeType: "application/pdf",
          blob: new Blob(["nope"], { type: "application/pdf" }),
        }),
      ),
    ).rejects.toThrow(/cannot be filed/);
  });

  it("stores weather as unverified when the field is blank", async () => {
    const job = await saveProject(blankProject({ name: "St. Peter Church" }));
    const saved = await saveReport(blankReport(job.id, { weatherText: "  ", weatherEntered: true }));
    expect(saved.weatherEntered).toBe(false);
    expect(saved.weatherText).toBe("");
  });

  it("refuses to mark an item done without evidence", async () => {
    const job = await saveProject(blankProject({ name: "Findley State Park" }));
    await expect(saveTask(blankTask(job.id, { title: "Close it", status: "done", evidence: "  " }))).rejects.toThrow(/evidence/i);
  });
});
