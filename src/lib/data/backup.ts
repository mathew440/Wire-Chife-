import { db } from "@/lib/data/db";
import { migrateSeededProjectManager } from "@/lib/data/role-migration";
import type {
  Assignment,
  Attachment,
  ChangeLogEntry,
  DailyReport,
  Estimate,
  LogItem,
  Person,
  Project,
  ScheduleDate,
  Settings,
  Task,
} from "@/lib/data/types";

export interface BackupFile {
  app: "wire-chief";
  version: 1;
  exportedAt: string;
  settings: Settings | null;
  projects: Project[];
  people: Person[];
  assignments: Assignment[];
  reports: DailyReport[];
  tasks: Task[];
  estimates: Estimate[];
  schedule: ScheduleDate[];
  attachments: Array<Omit<Attachment, "blob"> & { dataBase64: string }>;
  changelog: ChangeLogEntry[];
  /** Absent on backups exported before the submittal and RFI log. */
  logItems?: LogItem[];
}

export async function exportBackup(): Promise<BackupFile> {
  const attachments = await db.attachments.toArray();
  const encoded = await Promise.all(
    attachments.map(async (attachment) => {
      const { blob, ...rest } = attachment;
      return { ...rest, dataBase64: await blobToBase64(blob) };
    }),
  );
  return {
    app: "wire-chief",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get("local")) ?? null,
    projects: await db.projects.toArray(),
    people: await db.people.toArray(),
    assignments: await db.assignments.toArray(),
    reports: await db.reports.toArray(),
    tasks: await db.tasks.toArray(),
    estimates: await db.estimates.toArray(),
    schedule: await db.schedule.toArray(),
    attachments: encoded,
    changelog: await db.changelog.toArray(),
    logItems: await db.logItems.toArray(),
  };
}

export function backupFileName(exportedAt: string): string {
  return `wire-chief-backup-${exportedAt.slice(0, 10)}.json`;
}

export interface BackupJobChoice {
  id: string;
  name: string;
  jobNumber: string;
}

function assertBackup(file: BackupFile): void {
  if (file.app !== "wire-chief" || file.version !== 1) {
    throw new Error("That file is not a Wire Chief backup.");
  }
}

function decodeAttachments(file: BackupFile): Attachment[] {
  return (file.attachments ?? []).map((attachment) => {
    const { dataBase64, ...rest } = attachment;
    return { ...rest, blob: base64ToBlob(dataBase64, rest.mimeType) };
  });
}

export function jobsInBackup(file: BackupFile): BackupJobChoice[] {
  assertBackup(file);
  return (file.projects ?? [])
    .filter((project) => project && project.deletedAt == null)
    .map((project) => ({
      id: project.id,
      name: project.name || "Untitled job",
      jobNumber: project.jobNumber || "",
    }));
}

export async function importBackup(file: BackupFile): Promise<void> {
  assertBackup(file);
  const attachments = decodeAttachments(file);
  await db.transaction(
    "rw",
    [
      db.projects,
      db.people,
      db.assignments,
      db.reports,
      db.tasks,
      db.estimates,
      db.schedule,
      db.attachments,
      db.logItems,
      db.changelog,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.people.clear(),
        db.assignments.clear(),
        db.reports.clear(),
        db.tasks.clear(),
        db.estimates.clear(),
        db.schedule.clear(),
        db.attachments.clear(),
        db.logItems.clear(),
        db.changelog.clear(),
        db.settings.clear(),
      ]);
      await db.projects.bulkPut(file.projects ?? []);
      await db.people.bulkPut(file.people ?? []);
      await db.assignments.bulkPut(file.assignments ?? []);
      await db.reports.bulkPut(file.reports ?? []);
      await db.tasks.bulkPut(file.tasks ?? []);
      await db.estimates.bulkPut(file.estimates ?? []);
      await db.schedule.bulkPut(file.schedule ?? []);
      await db.attachments.bulkPut(attachments);
      await db.logItems.bulkPut(file.logItems ?? []);
      await db.changelog.bulkPut(file.changelog ?? []);
      if (file.settings) await db.settings.put(file.settings);
    },
  );
  await migrateSeededProjectManager();
}

/**
 * Add or update one job from a backup. Other jobs, the profile, and rows on
 * this phone that are not in the file stay put.
 */
export async function importJob(file: BackupFile, projectId: string): Promise<void> {
  assertBackup(file);
  const project = (file.projects ?? []).find((item) => item.id === projectId && item.deletedAt == null);
  if (!project) throw new Error("That job is not in this backup.");
  const reports = (file.reports ?? []).filter((row) => row.projectId === projectId);
  const tasks = (file.tasks ?? []).filter((row) => row.projectId === projectId);
  const estimates = (file.estimates ?? []).filter((row) => row.projectId === projectId);
  const schedule = (file.schedule ?? []).filter((row) => row.projectId === projectId);
  const logItems = (file.logItems ?? []).filter((row) => row.projectId === projectId);
  const assignments = (file.assignments ?? []).filter((row) => row.projectId === projectId);
  const personIds = new Set(assignments.map((row) => row.personId));
  const people = (file.people ?? []).filter((person) => personIds.has(person.id));
  const attachments = decodeAttachments(file).filter((row) => row.projectId === projectId);
  await db.transaction(
    "rw",
    [db.projects, db.people, db.assignments, db.reports, db.tasks, db.estimates, db.schedule, db.attachments, db.logItems],
    async () => {
      await db.projects.put(project);
      if (people.length) await db.people.bulkPut(people);
      if (assignments.length) await db.assignments.bulkPut(assignments);
      if (reports.length) await db.reports.bulkPut(reports);
      if (tasks.length) await db.tasks.bulkPut(tasks);
      if (estimates.length) await db.estimates.bulkPut(estimates);
      if (schedule.length) await db.schedule.bulkPut(schedule);
      if (attachments.length) await db.attachments.bulkPut(attachments);
      if (logItems.length) await db.logItems.bulkPut(logItems);
    },
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}
