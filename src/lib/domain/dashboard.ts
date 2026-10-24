import type { Confirmation, Estimate, ScheduleDate, Task } from "@/lib/data/types";
import { dayOffset } from "@/lib/domain/dates";

export interface ReportSummary {
  id: string;
  projectId: string;
  date: string;
  dateConfirmation: Confirmation;
  weatherText: string;
  weatherEntered: boolean;
  completed: string;
  updatedAt: string;
}

export interface UpcomingEntry {
  id: string;
  projectId: string;
  date: string;
  confirmation: Confirmation;
  label: string;
  kind: string;
  overdue: boolean;
  href: string;
}

export function isOpenTask(task: Pick<Task, "status" | "deletedAt">): boolean {
  return task.deletedAt == null && task.status !== "done";
}

export function isOverdueTask(task: Pick<Task, "status" | "deletedAt" | "dueDate">, today: string): boolean {
  if (!isOpenTask(task) || !task.dueDate) return false;
  return task.dueDate < today;
}

export function latestReport<T extends ReportSummary>(reports: T[]): T | null {
  const live = reports.filter((report) => report.date);
  if (live.length === 0) return null;
  return [...live].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  })[0];
}

export function buildUpcoming(input: {
  today: string;
  tasks: Task[];
  schedule: ScheduleDate[];
  estimates: Estimate[];
}): UpcomingEntry[] {
  const entries: UpcomingEntry[] = [];

  for (const item of input.schedule) {
    if (item.deletedAt) continue;
    entries.push({
      id: item.id,
      projectId: item.projectId,
      date: item.date,
      confirmation: item.confirmation,
      label: item.label,
      kind: item.kind,
      overdue: item.date < input.today,
      href: `/projects/${item.projectId}`,
    });
  }

  for (const task of input.tasks) {
    if (!isOpenTask(task) || !task.dueDate) continue;
    entries.push({
      id: task.id,
      projectId: task.projectId,
      date: task.dueDate,
      confirmation: task.dueConfirmation,
      label: task.title,
      kind: "open item",
      overdue: task.dueDate < input.today,
      href: `/projects/${task.projectId}/tasks/${task.id}`,
    });
  }

  for (const estimate of input.estimates) {
    if (estimate.deletedAt || !estimate.neededBy) continue;
    entries.push({
      id: estimate.id,
      projectId: estimate.projectId,
      date: estimate.neededBy,
      confirmation: estimate.neededByConfirmation,
      label: estimate.title,
      kind: "estimate needed",
      overdue: estimate.neededBy < input.today,
      href: `/projects/${estimate.projectId}/estimates/${estimate.id}`,
    });
  }

  return entries.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function projectPulse(input: {
  today: string;
  tasks: Task[];
  reports: ReportSummary[];
  schedule: ScheduleDate[];
  estimates: Estimate[];
}) {
  const openTasks = input.tasks.filter((task) => isOpenTask(task));
  const overdueTasks = openTasks.filter((task) => isOverdueTask(task, input.today));
  const upcoming = buildUpcoming(input);
  const next = upcoming.find((entry) => entry.date >= input.today) ?? null;
  return {
    openCount: openTasks.length,
    overdueCount: overdueTasks.length,
    overdueTasks,
    openTasks,
    latest: latestReport(input.reports),
    upcoming,
    next,
  };
}

export function relativeDay(iso: string, today: string): string {
  const offset = dayOffset(iso, today);
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset === -1) return "yesterday";
  return iso;
}
