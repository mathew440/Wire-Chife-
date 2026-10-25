import Dexie, { type Table } from "dexie";
import type {
  Assignment,
  Attachment,
  ChangeLogEntry,
  DailyReport,
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

/**
 * Schema version 1 is the local-only book. Version 2 adds the submittal and
 * RFI log. Version 3 adds material orders, hours allowed, and time entries.
 * Do not rewrite an older version. Extra fields on existing rows do not
 * need a version bump and are not deleted.
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
  logItems!: Table<LogItem, string>;
  orders!: Table<MaterialOrder, string>;
  laborBudgets!: Table<LaborBudget, string>;
  timeEntries!: Table<TimeEntry, string>;
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
    this.version(2).stores({
      logItems: "id, projectId, kind, status, dueDate",
    });
    this.version(3).stores({
      orders: "id, projectId, status, expectedDate",
      laborBudgets: "id, projectId",
      timeEntries: "id, projectId, date",
    });
  }
}

export const db = new WireChiefDB();
