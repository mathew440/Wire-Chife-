import { blankLaborBudget, blankReport, blankTimeEntry } from "@/lib/data/factories";
import { summarizeHours } from "@/lib/domain/hours";
import { describe, expect, it } from "vitest";

describe("labor hours", () => {
  it("uses typed hours on a day and report hours only on days with no time entry", () => {
    const summary = summarizeHours({
      budgets: [blankLaborBudget("job-a", { label: "Total", allowedHours: 40 })],
      entries: [
        blankTimeEntry("job-a", { date: "2026-10-22", hours: 8, workerName: "Alex" }),
        blankTimeEntry("job-a", { date: "2026-10-24", hours: 4 }),
      ],
      reports: [
        blankReport("job-a", {
          date: "2026-10-22",
          manpower: [{ id: "m1", personId: null, name: "Alex", hours: 10, area: "" }],
        }),
        blankReport("job-a", {
          date: "2026-10-23",
          manpower: [{ id: "m2", personId: null, name: "Sam", hours: 6, area: "" }],
        }),
      ],
    });

    expect(summary.fromTimeEntries).toBe(12);
    expect(summary.fromReports).toBe(6);
    expect(summary.used).toBe(18);
    expect(summary.reportDaysSkipped).toEqual(["2026-10-22"]);
    expect(summary.allowed).toBe(40);
    expect(summary.remaining).toBe(22);
    expect(summary.percent).toBe(45);
    expect(summary.burnPerWeek).toBeCloseTo(18 / (3 / 7));
  });

  it("does not invent a weekly rate from a single day, or a percent when no hours are allowed", () => {
    const summary = summarizeHours({
      budgets: [],
      entries: [blankTimeEntry("job-a", { date: "2026-10-24", hours: 8 })],
      reports: [],
    });
    expect(summary.allowed).toBeNull();
    expect(summary.percent).toBeNull();
    expect(summary.burnPerWeek).toBeNull();
    expect(summary.used).toBe(8);
  });

  it("marks the percent at 80 and over 100 from the saved numbers", () => {
    const atEighty = summarizeHours({
      budgets: [blankLaborBudget("job-a", { allowedHours: 10 })],
      entries: [blankTimeEntry("job-a", { date: "2026-10-01", hours: 8 })],
      reports: [],
    });
    const over = summarizeHours({
      budgets: [blankLaborBudget("job-a", { allowedHours: 10 }), blankLaborBudget("job-a", { label: "Rough-in", allowedHours: 0 })],
      entries: [blankTimeEntry("job-a", { date: "2026-10-01", hours: 12 })],
      reports: [],
    });
    expect(atEighty.percent).toBe(80);
    expect(over.percent).toBe(120);
    expect(over.remaining).toBe(-2);
    expect(over.allowed).toBe(10);
  });
});
