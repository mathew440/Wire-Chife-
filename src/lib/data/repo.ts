import { db } from "@/lib/data/db";
import { newId, nowIso } from "@/lib/data/id";
import type {
  Assignment,
  Attachment,
  AttachmentParent,
  ChangeLogEntry,
  DailyReport,
  EntityMeta,
  Estimate,
  Person,
  Project,
  ScheduleDate,
  Settings,
  Task,
} from "@/lib/data/types";
import { normalizeWeather } from "@/lib/domain/reports";
import type { Table } from "dexie";

const live = <T extends EntityMeta>(rows: T[]) => rows.filter((row) => row.deletedAt == null);

async function put<T extends EntityMeta>(table: Table<T, string>, entity: string, input: T): Promise<T> {
  const now = nowIso();
  return db.transaction("rw", table, db.changelog, async () => {
    const existing = await table.get(input.id);
    const next = {
      ...input,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
      deletedAt: input.deletedAt ?? null,
      syncState: "pending",
      rev: (existing?.rev ?? 0) + 1,
    } as T;
    await table.put(next);
    const entry: ChangeLogEntry = {
      id: newId(),
      entity,
      entityId: next.id,
      op: next.deletedAt ? "delete" : "upsert",
      rev: next.rev,
      at: now,
    };
    await db.changelog.add(entry);
    return next;
  });
}

async function remove<T extends EntityMeta>(table: Table<T, string>, entity: string, id: string): Promise<void> {
  const existing = await table.get(id);
  if (!existing || existing.deletedAt) return;
  await put(table, entity, { ...existing, deletedAt: nowIso() });
}

export async function listProjects(): Promise<Project[]> {
  const rows = live(await db.projects.toArray());
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const row = await db.projects.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveProject(project: Project): Promise<Project> {
  return put(db.projects, "projects", project);
}

export async function listPeople(): Promise<Person[]> {
  const rows = live(await db.people.toArray());
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePerson(person: Person): Promise<Person> {
  return put(db.people, "people", { ...person, name: person.name.trim() });
}

export async function deletePerson(id: string): Promise<void> {
  await remove(db.people, "people", id);
  const assignments = await db.assignments.filter((row) => row.personId === id && row.deletedAt == null).toArray();
  for (const assignment of assignments) {
    await remove(db.assignments, "assignments", assignment.id);
  }
}

export async function listAssignments(filter?: { projectId?: string; date?: string }): Promise<Assignment[]> {
  const rows = live(await db.assignments.toArray()).filter((row) => {
    if (filter?.projectId && row.projectId !== filter.projectId) return false;
    if (filter?.date && row.date !== filter.date) return false;
    return true;
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.area.localeCompare(b.area));
}

export async function saveAssignment(assignment: Assignment): Promise<Assignment> {
  if (!assignment.projectId || !assignment.personId) {
    throw new Error("An assignment needs a person and a job.");
  }
  const project = await getProject(assignment.projectId);
  if (!project) throw new Error("That job is not on this device.");
  return put(db.assignments, "assignments", assignment);
}

export async function deleteAssignment(id: string): Promise<void> {
  await remove(db.assignments, "assignments", id);
}

export async function listAllReports(): Promise<DailyReport[]> {
  return live(await db.reports.toArray());
}

export async function listReports(projectId: string): Promise<DailyReport[]> {
  const rows = live(await db.reports.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function getReport(id: string): Promise<DailyReport | undefined> {
  const row = await db.reports.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveReport(report: DailyReport): Promise<DailyReport> {
  const project = await getProject(report.projectId);
  if (!project) throw new Error("That job is not on this device.");
  return put(db.reports, "reports", normalizeWeather(report));
}

export async function deleteReport(id: string): Promise<void> {
  await remove(db.reports, "reports", id);
}

export async function listTasks(projectId?: string): Promise<Task[]> {
  const rows = live(await db.tasks.toArray()).filter((row) => (projectId ? row.projectId === projectId : true));
  return rows.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    const ad = a.dueDate ?? "9999-99-99";
    const bd = b.dueDate ?? "9999-99-99";
    return ad.localeCompare(bd) || a.title.localeCompare(b.title);
  });
}

export async function getTask(id: string): Promise<Task | undefined> {
  const row = await db.tasks.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveTask(task: Task): Promise<Task> {
  const project = await getProject(task.projectId);
  if (!project) throw new Error("That job is not on this device.");
  if (!task.title.trim()) throw new Error("An open item needs a title.");
  if (task.status === "done" && !task.evidence.trim()) {
    throw new Error("Add the evidence or source before marking this done.");
  }
  return put(db.tasks, "tasks", { ...task, title: task.title.trim(), evidence: task.evidence.trim() });
}

export async function deleteTask(id: string): Promise<void> {
  await remove(db.tasks, "tasks", id);
}

export async function listAllEstimates(): Promise<Estimate[]> {
  return live(await db.estimates.toArray());
}

export async function listEstimates(projectId: string): Promise<Estimate[]> {
  const rows = live(await db.estimates.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getEstimate(id: string): Promise<Estimate | undefined> {
  const row = await db.estimates.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveEstimate(estimate: Estimate): Promise<Estimate> {
  const project = await getProject(estimate.projectId);
  if (!project) throw new Error("That job is not on this device.");
  if (!estimate.title.trim()) throw new Error("An estimate needs a title.");
  const materials = estimate.materials.map((line) => ({
    ...line,
    qty: Number.isFinite(line.qty) ? line.qty : 0,
  }));
  return put(db.estimates, "estimates", {
    ...estimate,
    title: estimate.title.trim(),
    materials,
    crewSize: Math.max(0, Math.round(estimate.crewSize)),
    duration: Math.max(0, estimate.duration),
  });
}

export async function deleteEstimate(id: string): Promise<void> {
  await remove(db.estimates, "estimates", id);
}

export async function listAllSchedule(): Promise<ScheduleDate[]> {
  return live(await db.schedule.toArray());
}

export async function listSchedule(projectId: string): Promise<ScheduleDate[]> {
  const rows = live(await db.schedule.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveSchedule(item: ScheduleDate): Promise<ScheduleDate> {
  const project = await getProject(item.projectId);
  if (!project) throw new Error("That job is not on this device.");
  if (!item.label.trim() || !item.date) throw new Error("A date needs a label and a day.");
  return put(db.schedule, "schedule", { ...item, label: item.label.trim() });
}

export async function deleteSchedule(id: string): Promise<void> {
  await remove(db.schedule, "schedule", id);
}

export async function listAttachments(projectId: string): Promise<Attachment[]> {
  const rows = live(await db.attachments.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAttachment(id: string): Promise<Attachment | undefined> {
  const row = await db.attachments.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveAttachment(attachment: Attachment): Promise<Attachment> {
  await assertAttachmentParent(attachment.projectId, attachment.parentType, attachment.parentId);
  return put(db.attachments, "attachments", attachment);
}

export async function deleteAttachment(id: string): Promise<void> {
  await remove(db.attachments, "attachments", id);
}

export async function assertAttachmentParent(
  projectId: string,
  parentType: AttachmentParent,
  parentId: string,
): Promise<void> {
  if (parentType === "project") {
    if (parentId !== projectId) {
      throw new Error("A file for one job cannot be filed on another.");
    }
    const project = await getProject(projectId);
    if (!project) throw new Error("That job is not on this device.");
    return;
  }
  if (parentType === "report") {
    const report = await getReport(parentId);
    if (!report || report.projectId !== projectId) {
      throw new Error("That report is not on this job.");
    }
    return;
  }
  if (parentType === "task") {
    const task = await getTask(parentId);
    if (!task || task.projectId !== projectId) {
      throw new Error("That open item is not on this job.");
    }
    return;
  }
  const estimate = await getEstimate(parentId);
  if (!estimate || estimate.projectId !== projectId) {
    throw new Error("That estimate is not on this job.");
  }
}

export async function deleteProject(id: string): Promise<void> {
  const project = await db.projects.get(id);
  if (!project || project.deletedAt) return;
  const reports = await db.reports.where("projectId").equals(id).toArray();
  const tasks = live(await db.tasks.toArray()).filter((row) => row.projectId === id);
  const estimates = await db.estimates.where("projectId").equals(id).toArray();
  const schedule = await db.schedule.where("projectId").equals(id).toArray();
  const assignments = live(await db.assignments.toArray()).filter((row) => row.projectId === id);
  const attachments = await db.attachments.where("projectId").equals(id).toArray();
  for (const row of reports) if (!row.deletedAt) await remove(db.reports, "reports", row.id);
  for (const row of tasks) await remove(db.tasks, "tasks", row.id);
  for (const row of estimates) if (!row.deletedAt) await remove(db.estimates, "estimates", row.id);
  for (const row of schedule) if (!row.deletedAt) await remove(db.schedule, "schedule", row.id);
  for (const row of assignments) await remove(db.assignments, "assignments", row.id);
  for (const row of attachments) if (!row.deletedAt) await remove(db.attachments, "attachments", row.id);
  await remove(db.projects, "projects", id);
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get("local");
  if (existing && !existing.deletedAt) return normalizeSettings(existing);
  const { defaultSettings } = await import("@/lib/data/factories");
  return put(db.settings, "settings", defaultSettings());
}

function normalizeSettings(settings: Settings): Settings {
  const stored = settings as Settings & {
    profileRole?: string;
    foremanName?: string;
    seededRoleMigrated?: boolean;
  };
  return {
    ...settings,
    profileRole: stored.profileRole ?? "",
    foremanName: stored.foremanName ?? "",
    seededRoleMigrated: stored.seededRoleMigrated ?? false,
  };
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  return put(db.settings, "settings", { ...settings, id: "local" });
}

export async function listChangelog(): Promise<ChangeLogEntry[]> {
  const rows = await db.changelog.toArray();
  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

export async function removeSampleData(): Promise<void> {
  const projects = live(await db.projects.toArray()).filter((project) => project.isSample);
  for (const project of projects) await deleteProject(project.id);
  const people = live(await db.people.toArray()).filter((person) => person.isSample);
  for (const person of people) await deletePerson(person.id);
}
