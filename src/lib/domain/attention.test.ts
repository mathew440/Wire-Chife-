import { blankLogItem, blankProject, blankTask } from "@/lib/data/factories";
import { buildAttention } from "@/lib/domain/attention";
import { isDueSoonLog, isOverdueLog } from "@/lib/domain/logs";
import { describe, expect, it } from "vitest";

describe("due and overdue attention", () => {
  const today = "2026-10-24";
  const jobA = blankProject({ id: "job-a", name: "Sample Job A" });
  const jobB = blankProject({ id: "job-b", name: "Sample Job B" });

  it("groups overdue and due-soon submittals, RFIs, and open items by owner", () => {
    const groups = buildAttention({
      today,
      projects: [jobA, jobB],
      logItems: [
        blankLogItem("job-a", "submittal", {
          id: "s1",
          number: "S-1",
          description: "Panel schedule",
          dueDate: "2026-10-20",
          status: "submitted",
          ballInCourt: "GC",
        }),
        blankLogItem("job-a", "rfi", {
          id: "r1",
          number: "R-1",
          description: "Fixture type",
          dueDate: "2026-10-28",
          status: "submitted",
          ballInCourt: "GC",
        }),
        blankLogItem("job-b", "submittal", {
          id: "s2",
          description: "Approved already",
          dueDate: "2026-10-01",
          status: "approved",
          ballInCourt: "GC",
        }),
        blankLogItem("job-a", "submittal", {
          id: "s3",
          description: "No date",
          dueDate: null,
          status: "not-submitted",
          ballInCourt: "GC",
        }),
      ],
      tasks: [
        blankTask("job-a", { id: "t1", title: "Call inspector", dueDate: "2026-10-22", status: "open", owner: "" }),
        blankTask("job-b", { id: "t2", title: "Done item", dueDate: "2026-10-01", status: "done", owner: "GC", evidence: "note" }),
      ],
    });

    expect(groups.map((group) => group.owner)).toEqual(["GC", "No owner"]);
    const gc = groups[0]?.items.map((item) => item.label);
    expect(gc).toEqual(["S-1 · Panel schedule", "R-1 · Fixture type"]);
    expect(groups[0]?.items[0]?.timing).toBe("overdue");
    expect(groups[0]?.items[1]?.timing).toBe("due-soon");
    expect(groups[1]?.items.map((item) => item.kind)).toEqual(["open item"]);
    expect(isOverdueLog(blankLogItem("job-a", "submittal", { status: "approved-as-noted", dueDate: "2026-01-01" }), today)).toBe(false);
    expect(isDueSoonLog(blankLogItem("job-a", "rfi", { status: "rejected", dueDate: "2026-10-31" }), today)).toBe(true);
    expect(isDueSoonLog(blankLogItem("job-a", "rfi", { status: "rejected", dueDate: "2026-12-01" }), today)).toBe(false);
  });
});
