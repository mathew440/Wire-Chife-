import { db } from "@/lib/data/db";
import { migrateSeededProjectManager } from "@/lib/data/role-migration";
import type {
  Assignment,
  Attachment,
  ChangeLogEntry,
  DailyReport,
  Estimate,
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
  };
}

export function backupFileName(exportedAt: string): string {
  return `wire-chief-backup-${exportedAt.slice(0, 10)}.json`;
}

export async function importBackup(file: BackupFile): Promise<void> {
  if (file.app !== "wire-chief" || file.version !== 1) {
    throw new Error("That file is not a Wire Chief backup.");
  }
  const attachments: Attachment[] = (file.attachments ?? []).map((attachment) => {
    const { dataBase64, ...rest } = attachment;
    return { ...rest, blob: base64ToBlob(dataBase64, rest.mimeType) };
  });
  await db.transaction(
    "rw",
    [db.projects, db.people, db.assignments, db.reports, db.tasks, db.estimates, db.schedule, db.attachments, db.changelog, db.settings],
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
      await db.changelog.bulkPut(file.changelog ?? []);
      if (file.settings) await db.settings.put(file.settings);
    },
  );
  await migrateSeededProjectManager();
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
