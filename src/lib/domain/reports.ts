import type { DailyReport, ReportNoteKey, ReportSectionKey } from "@/lib/data/types";

/**
 * The four work statuses stay independent. Nothing in this module copies
 * text from one into another, and nothing promotes Planned or Needs
 * verification when a date passes.
 */
export const REPORT_SECTIONS: ReadonlyArray<{
  key: ReportSectionKey;
  label: string;
  hint: string;
}> = [
  { key: "completed", label: "Completed", hint: "Work that got finished today." },
  { key: "ongoing", label: "Ongoing", hint: "Started, and still open at the end of the day." },
  { key: "planned", label: "Planned", hint: "Intention only. Not started." },
  {
    key: "needsVerification",
    label: "Needs verification",
    hint: "Do not treat this as fact until someone checks it.",
  },
];

export const REPORT_NOTES: ReadonlyArray<{ key: ReportNoteKey; label: string }> = [
  { key: "punchItems", label: "Punch items" },
  { key: "inspections", label: "Inspections" },
  { key: "materials", label: "Materials" },
  { key: "blockers", label: "Blockers" },
  { key: "decisions", label: "Decisions" },
  { key: "tomorrowOutlook", label: "Tomorrow's outlook" },
];

export function appendToReportSection(
  report: DailyReport,
  key: ReportSectionKey,
  text: string,
): DailyReport {
  const chunk = text.trim();
  if (!chunk) return report;
  const previous = report[key].trim();
  return {
    ...report,
    [key]: previous ? `${previous}\n\n${chunk}` : chunk,
  };
}

export function weatherLabel(report: Pick<DailyReport, "weatherText" | "weatherEntered">): {
  entered: boolean;
  text: string;
} {
  const typed = report.weatherText.trim();
  if (!report.weatherEntered || typed.length === 0) {
    return { entered: false, text: "UNVERIFIED — weather was not entered" };
  }
  return { entered: true, text: typed };
}

export function normalizeWeather<T extends Pick<DailyReport, "weatherText" | "weatherEntered">>(
  report: T,
): T {
  const weatherText = report.weatherText.trim();
  return {
    ...report,
    weatherText,
    weatherEntered: weatherText.length > 0,
  };
}
