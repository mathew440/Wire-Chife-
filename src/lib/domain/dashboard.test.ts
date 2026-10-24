import { blankEstimate, blankSchedule, blankTask } from "@/lib/data/factories";
import { buildUpcoming, isOverdueTask, projectPulse } from "@/lib/domain/dashboard";
import { describe, expect, it } from "vitest";

describe("project dashboard", () => {
  const today = "2026-10-23";

  it("counts open and overdue items without treating done work as overdue", () => {
    const tasks = [
      blankTask("job-a", { id: "1", title: "Late", dueDate: "2026-10-22", status: "open", dueConfirmation: "tentative" }),
      blankTask("job-a", { id: "2", title: "Finished late", dueDate: "2026-10-20", status: "done", dueConfirmation: "confirmed" }),
      blankTask("job-b", { id: "3", title: "Other job", dueDate: "2026-10-01", status: "open", dueConfirmation: "tentative" }),
    ];
    const pulse = projectPulse({
      today,
      tasks: tasks.filter((task) => task.projectId === "job-a"),
      reports: [],
      schedule: [],
      estimates: [],
    });
    expect(pulse.openCount).toBe(1);
    expect(pulse.overdueCount).toBe(1);
    expect(isOverdueTask(tasks[1], today)).toBe(false);
  });

  it("keeps tentative and confirmed on every upcoming date", () => {
    const upcoming = buildUpcoming({
      today,
      tasks: [blankTask("job-a", { title: "Inspect", dueDate: "2026-10-25", dueConfirmation: "tentative", status: "open" })],
      schedule: [blankSchedule("job-a", { label: "Delivery", date: "2026-10-28", confirmation: "confirmed" })],
      estimates: [blankEstimate("job-a", { title: "Takeoff", neededBy: "2026-10-30", neededByConfirmation: "tentative" })],
    });
    expect(upcoming.map((entry) => entry.confirmation)).toEqual(["tentative", "confirmed", "tentative"]);
    expect(upcoming.every((entry) => entry.confirmation === "tentative" || entry.confirmation === "confirmed")).toBe(true);
  });
});
