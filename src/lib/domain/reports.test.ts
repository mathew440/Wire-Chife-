import { blankReport } from "@/lib/data/factories";
import { REPORT_SECTIONS, appendToReportSection, normalizeWeather, weatherLabel } from "@/lib/domain/reports";
import { describe, expect, it } from "vitest";

describe("daily report sections", () => {
  it("sends dictated text into only the section the user picks", () => {
    const report = blankReport("job-a", {
      completed: "Home runs in.",
      ongoing: "Corridor conduit.",
      planned: "Trim tomorrow.",
      needsVerification: "Panel schedule.",
    });
    const next = appendToReportSection(report, "planned", "Ask drywall before we cover.");
    expect(next.planned).toBe("Trim tomorrow.\n\nAsk drywall before we cover.");
    expect(next.completed).toBe(report.completed);
    expect(next.ongoing).toBe(report.ongoing);
    expect(next.needsVerification).toBe(report.needsVerification);
    expect(REPORT_SECTIONS.map((section) => section.key)).toEqual([
      "completed",
      "ongoing",
      "planned",
      "needsVerification",
    ]);
  });

  it("leaves weather unverified until someone types it", () => {
    const blank = weatherLabel({ weatherText: "  ", weatherEntered: true });
    expect(blank.entered).toBe(false);
    expect(blank.text).toContain("UNVERIFIED");
    const entered = weatherLabel(normalizeWeather({ weatherText: " Clear, 52 F ", weatherEntered: false }));
    expect(entered.entered).toBe(true);
    expect(entered.text).toBe("Clear, 52 F");
    const forced = normalizeWeather({ weatherText: "", weatherEntered: true });
    expect(forced.weatherEntered).toBe(false);
  });
});
