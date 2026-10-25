import type { DailyReport, LaborBudget, TimeEntry } from "@/lib/data/types";
import { dayOffset } from "@/lib/domain/dates";

export interface CountedHours {
  date: string;
  hours: number;
  source: "time entry" | "daily report";
}

export interface HoursSummary {
  allowed: number | null;
  used: number;
  remaining: number | null;
  /** Null when hours allowed is missing or zero. */
  percent: number | null;
  /** Null until hours are saved on at least two different days. */
  burnPerWeek: number | null;
  fromTimeEntries: number;
  fromReports: number;
  counted: CountedHours[];
  /** Report days left out because that day already has typed hours. */
  reportDaysSkipped: string[];
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function finiteHours(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function summarizeHours(input: {
  budgets: LaborBudget[];
  entries: TimeEntry[];
  reports: DailyReport[];
}): HoursSummary {
  const budgets = input.budgets.filter((row) => row.deletedAt == null);
  const allowed = budgets.length === 0 ? null : budgets.reduce((sum, row) => sum + (Number.isFinite(row.allowedHours) ? row.allowedHours : 0), 0);

  const timeByDate = new Map<string, number>();
  for (const entry of input.entries) {
    if (entry.deletedAt || !entry.date) continue;
    const hours = finiteHours(entry.hours);
    if (hours <= 0) continue;
    timeByDate.set(entry.date, (timeByDate.get(entry.date) ?? 0) + hours);
  }

  const reportByDate = new Map<string, number>();
  for (const report of input.reports) {
    if (report.deletedAt || !report.date) continue;
    const hours = report.manpower.reduce((sum, row) => sum + finiteHours(row.hours), 0);
    if (hours <= 0) continue;
    reportByDate.set(report.date, (reportByDate.get(report.date) ?? 0) + hours);
  }

  const counted: CountedHours[] = [];
  const reportDaysSkipped: string[] = [];
  let fromTimeEntries = 0;
  let fromReports = 0;
  const dates = [...new Set([...timeByDate.keys(), ...reportByDate.keys()])].sort();
  for (const date of dates) {
    const typed = timeByDate.get(date) ?? 0;
    if (typed > 0) {
      fromTimeEntries += typed;
      counted.push({ date, hours: typed, source: "time entry" });
      if ((reportByDate.get(date) ?? 0) > 0) reportDaysSkipped.push(date);
      continue;
    }
    const reported = reportByDate.get(date) ?? 0;
    if (reported > 0) {
      fromReports += reported;
      counted.push({ date, hours: reported, source: "daily report" });
    }
  }

  const used = fromTimeEntries + fromReports;
  const remaining = allowed == null ? null : allowed - used;
  const percent = allowed != null && allowed > 0 ? (used / allowed) * 100 : null;
  const burnDates = [...new Set(counted.map((row) => row.date))].sort();
  let burnPerWeek: number | null = null;
  if (burnDates.length >= 2) {
    const spanDays = dayOffset(burnDates[burnDates.length - 1]!, burnDates[0]!) + 1;
    if (spanDays > 0) burnPerWeek = used / (spanDays / 7);
  }

  return {
    allowed,
    used,
    remaining,
    percent,
    burnPerWeek,
    fromTimeEntries,
    fromReports,
    counted,
    reportDaysSkipped,
  };
}
