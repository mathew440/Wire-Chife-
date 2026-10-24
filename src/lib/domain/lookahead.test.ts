import { blankSchedule } from "@/lib/data/factories";
import { inLookahead, lookaheadItems, scheduleSpan } from "@/lib/domain/lookahead";
import type { ScheduleDate } from "@/lib/data/types";
import { describe, expect, it } from "vitest";

describe("look-ahead ranges", () => {
  const today = "2026-10-23";

  it("treats a missing end date as the start day and overlaps 2-week and 6-week windows", () => {
    const spanning = blankSchedule("job-a", {
      id: "span",
      label: "Inspection window",
      date: "2026-10-20",
      endDate: "2026-10-24",
      confirmation: "needs-verification",
      source: "GC note",
      asOf: "2026-10-23",
    });
    const soon = blankSchedule("job-a", { id: "soon", label: "Delivery", date: "2026-11-02", endDate: "2026-11-02", confirmation: "confirmed" });
    const later = blankSchedule("job-a", { id: "later", label: "Meeting", date: "2026-11-20", endDate: "2026-11-21", confirmation: "tentative" });
    const past = blankSchedule("job-a", { id: "past", label: "Done", date: "2026-10-01", endDate: "2026-10-02" });
    const legacy = { ...blankSchedule("job-a", { id: "legacy", label: "Old row", date: "2026-10-23" }), endDate: undefined } as unknown as ScheduleDate;

    expect(scheduleSpan(legacy)).toEqual({ start: "2026-10-23", end: "2026-10-23" });
    expect(inLookahead(spanning, today, 2)).toBe(true);
    expect(inLookahead(soon, today, 2)).toBe(true);
    expect(inLookahead(later, today, 2)).toBe(false);
    expect(inLookahead(later, today, 6)).toBe(true);
    expect(inLookahead(past, today, 6)).toBe(false);
    expect(lookaheadItems([later, spanning, past, soon], today, 6).map((item) => item.id)).toEqual(["span", "soon", "later"]);
    expect(spanning.confirmation).toBe("needs-verification");
  });
});
