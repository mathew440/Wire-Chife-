import type { ScheduleDate } from "@/lib/data/types";
import { addDays } from "@/lib/domain/dates";

export function scheduleSpan(item: Pick<ScheduleDate, "date" | "endDate">): { start: string; end: string } {
  const start = item.date;
  const end = item.endDate && item.endDate >= start ? item.endDate : start;
  return { start, end: end || start };
}

/** True when the date range overlaps today through the next 2 or 6 weeks. */
export function inLookahead(item: Pick<ScheduleDate, "date" | "endDate" | "deletedAt">, today: string, weeks: 2 | 6): boolean {
  if (item.deletedAt) return false;
  const { start, end } = scheduleSpan(item);
  const windowEnd = addDays(today, weeks * 7 - 1);
  return end >= today && start <= windowEnd;
}

export function lookaheadItems(items: ScheduleDate[], today: string, weeks: 2 | 6): ScheduleDate[] {
  return items
    .filter((item) => inLookahead(item, today, weeks))
    .sort((a, b) => scheduleSpan(a).start.localeCompare(scheduleSpan(b).start) || a.label.localeCompare(b.label));
}
