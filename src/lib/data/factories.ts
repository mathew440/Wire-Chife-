import { todayISO } from "@/lib/domain/dates";
import { newId, nowIso } from "@/lib/data/id";
import type {
  Assignment,
  Attachment,
  Contact,
  DailyReport,
  Estimate,
  MaterialLine,
  Person,
  Project,
  ScheduleDate,
  Settings,
  Task,
} from "@/lib/data/types";

function meta(id = newId()) {
  const now = nowIso();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: "pending" as const,
    rev: 0,
  };
}

export function blankContact(partial: Partial<Contact> = {}): Contact {
  return { id: newId(), name: "", role: "", phone: "", email: "", ...partial };
}

export function blankProject(partial: Partial<Project> = {}): Project {
  return {
    ...meta(),
    name: "",
    jobNumber: "",
    gc: "",
    location: "",
    description: "",
    status: "active",
    contacts: [],
    isSample: false,
    ...partial,
  };
}

export function blankPerson(partial: Partial<Person> = {}): Person {
  return {
    ...meta(),
    name: "",
    classification: "Journeyman",
    phone: "",
    isSample: false,
    ...partial,
  };
}

export function blankAssignment(partial: Partial<Assignment> = {}): Assignment {
  return {
    ...meta(),
    personId: "",
    projectId: "",
    date: todayISO(),
    area: "",
    hours: 8,
    confirmation: "confirmed",
    ...partial,
  };
}

export function blankReport(projectId: string, partial: Partial<DailyReport> = {}): DailyReport {
  return {
    ...meta(),
    projectId,
    date: todayISO(),
    dateConfirmation: "confirmed",
    weatherText: "",
    weatherEntered: false,
    manpower: [],
    completed: "",
    ongoing: "",
    planned: "",
    needsVerification: "",
    punchItems: "",
    inspections: "",
    materials: "",
    blockers: "",
    decisions: "",
    tomorrowOutlook: "",
    dictatedNotes: "",
    isSample: false,
    ...partial,
  };
}

export function blankTask(projectId: string, partial: Partial<Task> = {}): Task {
  return {
    ...meta(),
    projectId,
    title: "",
    details: "",
    owner: "",
    dueDate: null,
    dueConfirmation: "tentative",
    status: "open",
    evidence: "",
    isSample: false,
    ...partial,
  };
}

export function blankMaterialLine(partial: Partial<MaterialLine> = {}): MaterialLine {
  return { id: newId(), item: "", size: "", qty: 0, unit: "ea", ...partial };
}

export function blankEstimate(projectId: string, partial: Partial<Estimate> = {}): Estimate {
  return {
    ...meta(),
    projectId,
    title: "",
    scope: "",
    materials: [blankMaterialLine()],
    crewSize: 2,
    duration: 1,
    durationUnit: "days",
    notes: "",
    neededBy: null,
    neededByConfirmation: "tentative",
    isSample: false,
    ...partial,
  };
}

export function blankSchedule(projectId: string, partial: Partial<ScheduleDate> = {}): ScheduleDate {
  return {
    ...meta(),
    projectId,
    label: "",
    date: todayISO(),
    confirmation: "tentative",
    kind: "other",
    notes: "",
    ...partial,
  };
}

export function blankAttachment(
  projectId: string,
  partial: Partial<Attachment> & Pick<Attachment, "blob" | "fileName" | "mimeType">,
): Attachment {
  return {
    ...meta(),
    projectId,
    parentType: "project",
    parentId: projectId,
    size: partial.blob.size,
    isSample: false,
    ...partial,
  };
}

export function defaultSettings(): Settings {
  return {
    ...meta("local"),
    id: "local",
    profileName: "Mat Hiner",
    companyName: "AKA Electric",
    samplesSeeded: false,
    seedRevision: "",
  };
}
