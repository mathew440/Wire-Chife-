import { db } from "@/lib/data/db";
import { newId, nowIso } from "@/lib/data/id";
import type {
  Assignment,
  Attachment,
  AttachmentParent,
  ChangeLogEntry,
  Contact,
  DailyReport,
  EntityMeta,
  Estimate,
  LaborBudget,
  LogItem,
  MaterialOrder,
  Person,
  Project,
  ScheduleDate,
  Settings,
  Task,
  TimeEntry,
} from "@/lib/data/types";
import { scheduleSync } from "@/lib/sync/engine";
import { isScheduleConfirmation } from "@/lib/domain/dates";
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
  }).then((saved) => {
    scheduleSync();
    return saved;
  });
}

async function remove<T extends EntityMeta>(table: Table<T, string>, entity: string, id: string): Promise<void> {
  const existing = await table.get(id);
  if (!existing || existing.deletedAt) return;
  await put(table, entity, { ...existing, deletedAt: nowIso() });
}

function normalizeContact(contact: Contact): Contact {
  return { ...contact, email: contact.email ?? "", company: contact.company ?? "" };
}

function normalizeProject(project: Project): Project {
  return { ...project, contacts: (project.contacts ?? []).map(normalizeContact) };
}

export async function listProjects(): Promise<Project[]> {
  const rows = live(await db.projects.toArray()).map(normalizeProject);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const row = await db.projects.get(id);
  if (!row || row.deletedAt) return undefined;
  return normalizeProject(row);
}

export async function saveProject(project: Project): Promise<Project> {
  return put(db.projects, "projects", normalizeProject(project));
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

function normalizeSchedule(item: ScheduleDate): ScheduleDate {
  const date = item.date;
  const storedEnd = (item as ScheduleDate & { endDate?: string }).endDate;
  const endDate = storedEnd && storedEnd >= date ? storedEnd : date;
  const confirmation = isScheduleConfirmation(item.confirmation) ? item.confirmation : "tentative";
  return {
    ...item,
    date,
    endDate,
    confirmation,
    source: item.source ?? "",
    asOf: item.asOf ?? "",
  };
}

export async function listAllSchedule(): Promise<ScheduleDate[]> {
  return live(await db.schedule.toArray()).map(normalizeSchedule);
}

export async function listSchedule(projectId: string): Promise<ScheduleDate[]> {
  const rows = live(await db.schedule.where("projectId").equals(projectId).toArray()).map(normalizeSchedule);
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

export async function saveSchedule(item: ScheduleDate): Promise<ScheduleDate> {
  const project = await getProject(item.projectId);
  if (!project) throw new Error("That job is not on this device.");
  if (!item.label.trim() || !item.date) throw new Error("A date needs a label and a day.");
  const endDate = item.endDate || item.date;
  if (endDate < item.date) throw new Error("The end date cannot be before the start date.");
  return put(db.schedule, "schedule", normalizeSchedule({ ...item, label: item.label.trim(), endDate }));
}

export async function deleteSchedule(id: string): Promise<void> {
  await remove(db.schedule, "schedule", id);
}

function normalizeAttachment(row: Attachment): Attachment {
  return {
    ...row,
    area: row.area ?? "",
    caption: row.caption ?? "",
    takenDate: row.takenDate ?? null,
  };
}

export async function listAttachments(projectId: string): Promise<Attachment[]> {
  const rows = live(await db.attachments.where("projectId").equals(projectId).toArray()).map(normalizeAttachment);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAttachment(id: string): Promise<Attachment | undefined> {
  const row = await db.attachments.get(id);
  if (!row || row.deletedAt) return undefined;
  return normalizeAttachment(row);
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
  if (parentType === "photo") {
    if (parentId !== projectId) {
      throw new Error("A photo for one job cannot be filed on another.");
    }
    const project = await getProject(projectId);
    if (!project) throw new Error("That job is not on this device.");
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
  const logItems = live(await db.logItems.toArray()).filter((row) => row.projectId === id);
  const orders = live(await db.orders.toArray()).filter((row) => row.projectId === id);
  const budgets = live(await db.laborBudgets.toArray()).filter((row) => row.projectId === id);
  const timeEntries = live(await db.timeEntries.toArray()).filter((row) => row.projectId === id);
  for (const row of reports) if (!row.deletedAt) await remove(db.reports, "reports", row.id);
  for (const row of tasks) await remove(db.tasks, "tasks", row.id);
  for (const row of estimates) if (!row.deletedAt) await remove(db.estimates, "estimates", row.id);
  for (const row of schedule) if (!row.deletedAt) await remove(db.schedule, "schedule", row.id);
  for (const row of assignments) await remove(db.assignments, "assignments", row.id);
  for (const row of attachments) if (!row.deletedAt) await remove(db.attachments, "attachments", row.id);
  for (const row of logItems) await remove(db.logItems, "logItems", row.id);
  for (const row of orders) await remove(db.orders, "orders", row.id);
  for (const row of budgets) await remove(db.laborBudgets, "laborBudgets", row.id);
  for (const row of timeEntries) await remove(db.timeEntries, "timeEntries", row.id);
  await remove(db.projects, "projects", id);
}

export async function listAllLogItems(): Promise<LogItem[]> {
  return live(await db.logItems.toArray());
}

export async function listLogItems(projectId: string, kind?: LogItem["kind"]): Promise<LogItem[]> {
  const rows = live(await db.logItems.where("projectId").equals(projectId).toArray()).filter((row) =>
    kind ? row.kind === kind : true,
  );
  return rows.sort((a, b) => (a.number || a.description).localeCompare(b.number || b.description));
}

export async function getLogItem(id: string): Promise<LogItem | undefined> {
  const row = await db.logItems.get(id);
  if (!row || row.deletedAt) return undefined;
  return row;
}

export async function saveLogItem(item: LogItem): Promise<LogItem> {
  const project = await getProject(item.projectId);
  if (!project) throw new Error("That job is not on this device.");
  const number = item.number.trim();
  const description = item.description.trim();
  if (!number && !description) {
    throw new Error(item.kind === "rfi" ? "An RFI needs a number or a description." : "A submittal needs a number or a description.");
  }
  const contactId = item.contactId || null;
  if (contactId && !project.contacts.some((contact) => contact.id === contactId)) {
    throw new Error("That contact is not on this job.");
  }
  return put(db.logItems, "logItems", {
    ...item,
    number,
    description,
    specSection: item.specSection.trim(),
    ballInCourt: item.ballInCourt.trim(),
    notes: item.notes.trim(),
    sentDate: item.sentDate || null,
    dueDate: item.dueDate || null,
    contactId,
  });
}

export async function deleteLogItem(id: string): Promise<void> {
  await remove(db.logItems, "logItems", id);
}

export async function listAllOrders(): Promise<MaterialOrder[]> {
  return live(await db.orders.toArray());
}

export async function listOrders(projectId: string): Promise<MaterialOrder[]> {
  const rows = live(await db.orders.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => (a.expectedDate ?? "9999-99-99").localeCompare(b.expectedDate ?? "9999-99-99") || a.description.localeCompare(b.description));
}

export async function saveOrder(order: MaterialOrder): Promise<MaterialOrder> {
  const project = await getProject(order.projectId);
  if (!project) throw new Error("That job is not on this device.");
  const description = order.description.trim();
  if (!description) throw new Error("An order needs a description.");
  return put(db.orders, "orders", {
    ...order,
    description,
    vendor: order.vendor.trim(),
    poNumber: order.poNumber.trim(),
    quantity: order.quantity.trim(),
    notes: order.notes.trim(),
    orderedDate: order.orderedDate || null,
    expectedDate: order.expectedDate || null,
    deliveredDate: order.deliveredDate || null,
  });
}

export async function deleteOrder(id: string): Promise<void> {
  await remove(db.orders, "orders", id);
}

export async function listLaborBudgets(projectId: string): Promise<LaborBudget[]> {
  const rows = live(await db.laborBudgets.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export async function saveLaborBudget(budget: LaborBudget): Promise<LaborBudget> {
  const project = await getProject(budget.projectId);
  if (!project) throw new Error("That job is not on this device.");
  const label = budget.label.trim();
  if (!label) throw new Error("Name this group of hours, or leave it as Total.");
  if (!Number.isFinite(budget.allowedHours) || budget.allowedHours < 0) {
    throw new Error("Hours allowed needs a number that is zero or more.");
  }
  return put(db.laborBudgets, "laborBudgets", { ...budget, label, allowedHours: budget.allowedHours });
}

export async function deleteLaborBudget(id: string): Promise<void> {
  await remove(db.laborBudgets, "laborBudgets", id);
}

export async function listTimeEntries(projectId: string): Promise<TimeEntry[]> {
  const rows = live(await db.timeEntries.where("projectId").equals(projectId).toArray());
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.workerName.localeCompare(b.workerName));
}

export async function saveTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
  const project = await getProject(entry.projectId);
  if (!project) throw new Error("That job is not on this device.");
  if (!entry.date) throw new Error("A time entry needs a date.");
  if (!Number.isFinite(entry.hours) || entry.hours <= 0) throw new Error("Enter the hours worked.");
  return put(db.timeEntries, "timeEntries", {
    ...entry,
    hours: entry.hours,
    workerName: entry.workerName.trim(),
    note: entry.note.trim(),
  });
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await remove(db.timeEntries, "timeEntries", id);
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
    profileEmail?: string;
    seededRoleMigrated?: boolean;
    profileContactMigrated?: boolean;
    lastNotifiedOn?: string;
  };
  return {
    ...settings,
    profileRole: stored.profileRole ?? "",
    foremanName: stored.foremanName ?? "",
    profileEmail: stored.profileEmail ?? "",
    seededRoleMigrated: stored.seededRoleMigrated ?? false,
    profileContactMigrated: stored.profileContactMigrated ?? false,
    lastNotifiedOn: stored.lastNotifiedOn ?? "",
  };
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  return put(db.settings, "settings", { ...normalizeSettings(settings), id: "local" });
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
