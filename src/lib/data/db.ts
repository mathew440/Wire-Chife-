import Dexie, { type Table } from "dexie";
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

/**
 * Schema version 1 is the local-only book. Add a new version() block when
 * cloud sync needs columns. Do not rewrite this one under existing devices.
 */
export class WireChiefDB extends Dexie {
  projects!: Table<Project, string>;
  people!: Table<Person, string>;
  assignments!: Table<Assignment, string>;
  reports!: Table<DailyReport, string>;
  tasks!: Table<Task, string>;
  estimates!: Table<Estimate, string>;
  schedule!: Table<ScheduleDate, string>;
  attachments!: Table<Attachment, string>;
  changelog!: Table<ChangeLogEntry, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("wire-chief");
    this.version(1).stores({
      projects: "id, status, isSample, updatedAt",
      people: "id, name, isSample",
      assignments: "id, projectId, personId, date, [projectId+date]",
      reports: "id, projectId, date, [projectId+date]",
      tasks: "id, projectId, status, dueDate, owner",
      estimates: "id, projectId",
      schedule: "id, projectId, date",
      attachments: "id, projectId, parentType, parentId",
      changelog: "id, entity, entityId, at",
      settings: "id",
    });
  }
}

export const db = new WireChiefDB();
