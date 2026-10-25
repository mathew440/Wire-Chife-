/**
 * Wire Chief records live on the device. Every row carries sync metadata so a
 * later multi-user backend can push the change log without reshaping the jobs.
 * v1 never uploads these fields.
 */
export type SyncState = "local" | "pending" | "synced";

export interface EntityMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncState: SyncState;
  rev: number;
}

export type ProjectStatus = "unverified" | "bidding" | "active" | "punch" | "on-hold" | "complete";

export interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  /** Company the person works for. Empty on rows saved before this field existed. */
  company: string;
}

export interface Project extends EntityMeta {
  name: string;
  jobNumber: string;
  gc: string;
  location: string;
  description: string;
  status: ProjectStatus;
  contacts: Contact[];
  isSample: boolean;
}

export type Confirmation = "tentative" | "confirmed";

/** Schedule rows can also be unverified. Reports and crew stay on Confirmation. */
export type ScheduleConfirmation = Confirmation | "needs-verification";

export type ScheduleKind = "inspection" | "delivery" | "meeting" | "milestone" | "other";

export interface ScheduleDate extends EntityMeta {
  projectId: string;
  label: string;
  /** Inclusive start. Older rows only stored this day. */
  date: string;
  /** Inclusive end. Missing on older rows; treat that as the start day. */
  endDate: string;
  confirmation: ScheduleConfirmation;
  kind: ScheduleKind;
  notes: string;
  /** Where the date came from. Empty until someone types it. */
  source: string;
  /** Day this date was last checked. Empty until someone types it. */
  asOf: string;
}

export interface Person extends EntityMeta {
  name: string;
  classification: string;
  phone: string;
  isSample: boolean;
}

export interface Assignment extends EntityMeta {
  personId: string;
  projectId: string;
  date: string;
  area: string;
  hours: number | null;
  confirmation: Confirmation;
}

export interface ManpowerEntry {
  id: string;
  personId: string | null;
  name: string;
  hours: number | null;
  area: string;
}

export interface DailyReport extends EntityMeta {
  projectId: string;
  date: string;
  dateConfirmation: Confirmation;
  /** Empty unless someone typed it. Wire Chief does not look weather up. */
  weatherText: string;
  /** True only when weatherText was entered. Never inferred. */
  weatherEntered: boolean;
  manpower: ManpowerEntry[];
  completed: string;
  ongoing: string;
  planned: string;
  needsVerification: string;
  punchItems: string;
  inspections: string;
  materials: string;
  blockers: string;
  decisions: string;
  tomorrowOutlook: string;
  dictatedNotes: string;
  isSample: boolean;
}

export type ReportSectionKey = "completed" | "ongoing" | "planned" | "needsVerification";

export type ReportNoteKey =
  | "punchItems"
  | "inspections"
  | "materials"
  | "blockers"
  | "decisions"
  | "tomorrowOutlook";

export type TaskStatus = "open" | "in-progress" | "blocked" | "done";

export interface Task extends EntityMeta {
  projectId: string;
  title: string;
  details: string;
  owner: string;
  dueDate: string | null;
  dueConfirmation: Confirmation;
  status: TaskStatus;
  /** What document or person supports the status. */
  evidence: string;
  isSample: boolean;
}

export interface MaterialLine {
  id: string;
  item: string;
  size: string;
  qty: number;
  unit: string;
}

export type DurationUnit = "hours" | "days";

export interface Estimate extends EntityMeta {
  projectId: string;
  title: string;
  scope: string;
  materials: MaterialLine[];
  crewSize: number;
  duration: number;
  durationUnit: DurationUnit;
  notes: string;
  neededBy: string | null;
  neededByConfirmation: Confirmation;
  isSample: boolean;
}

export type LogKind = "submittal" | "rfi";

export type LogStatus =
  | "not-submitted"
  | "submitted"
  | "approved"
  | "approved-as-noted"
  | "revise-resubmit"
  | "rejected";

export interface LogItem extends EntityMeta {
  projectId: string;
  kind: LogKind;
  number: string;
  specSection: string;
  description: string;
  sentDate: string | null;
  dueDate: string | null;
  status: LogStatus;
  /** Who has the action. Free text, plus an optional contact on this job. */
  ballInCourt: string;
  contactId: string | null;
  notes: string;
}

export type AttachmentParent = "project" | "report" | "task" | "estimate" | "photo";

export interface Attachment extends EntityMeta {
  projectId: string;
  parentType: AttachmentParent;
  parentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  isSample: boolean;
  /** Set when parentType is "photo". Empty on drawings and older files. */
  area: string;
  caption: string;
  takenDate: string | null;
}

export interface Settings extends EntityMeta {
  id: "local";
  profileName: string;
  /** Role printed with the profile on reports. Default is Project Manager. */
  profileRole: string;
  /** Separate from the project manager. Blank until someone verifies the name. */
  foremanName: string;
  companyName: string;
  samplesSeeded: boolean;
  /**
   * Older apps set this once a starter book had been considered. Matching it
   * means this device is left alone. It does not cause jobs to be inserted.
   */
  seedRevision: string;
  /** True after the one-time Foreman → Project Manager seed correction. */
  seededRoleMigrated: boolean;
  /** Local calendar day a due-item notification was last shown. Empty if never. */
  lastNotifiedOn: string;
}

export interface ChangeLogEntry {
  id: string;
  entity: string;
  entityId: string;
  op: "upsert" | "delete";
  rev: number;
  at: string;
}
