import type { Contact, Project } from "@/lib/data/types";

/** Route id for contacts that are not stored on a job. Not a project id. */
export const GENERAL_CONTACT_GROUP_ID = "general";

export const GENERAL_CONTACT_GROUP_NAME = "No job / General";

export interface JobContactGroup {
  id: string;
  name: string;
  jobNumber: string;
  contacts: Contact[];
}

type ProjectContacts = Pick<Project, "id" | "name" | "jobNumber" | "contacts">;

/**
 * Contacts are stored on the project row (`project.contacts`). That row is the
 * job link in the shared records table. A contact whose project id is blank is
 * not tied to a job.
 */
export function contactHasDetails(contact: Partial<Contact> | null | undefined): boolean {
  if (!contact) return false;
  return [contact.name, contact.role, contact.phone, contact.email, contact.company].some(
    (value) => (value ?? "").trim().length > 0,
  );
}

export function groupContactsByJob(
  projects: ProjectContacts[],
  options?: { showEmptyGeneral?: boolean },
): JobContactGroup[] {
  const jobs: JobContactGroup[] = [];
  const loose: Contact[] = [];

  for (const project of projects) {
    const contacts = (project.contacts ?? []).filter(contactHasDetails);
    const id = (project.id ?? "").trim();
    if (!id) {
      loose.push(...contacts);
      continue;
    }
    jobs.push({
      id,
      name: project.name.trim() || "Untitled job",
      jobNumber: project.jobNumber.trim(),
      contacts,
    });
  }

  jobs.sort((a, b) => a.name.localeCompare(b.name) || a.jobNumber.localeCompare(b.jobNumber) || a.id.localeCompare(b.id));

  if (loose.length > 0 || options?.showEmptyGeneral) {
    jobs.push({
      id: GENERAL_CONTACT_GROUP_ID,
      name: GENERAL_CONTACT_GROUP_NAME,
      jobNumber: "",
      contacts: loose,
    });
  }

  return jobs;
}

export function contactCountLabel(count: number): string {
  return count === 1 ? "1 contact" : `${count} contacts`;
}

/** Replace one contact on a job, or append it. Other contacts stay as stored. */
export function upsertProjectContact<T extends Contact>(contacts: T[], contact: T): T[] {
  if (!contactHasDetails(contact)) {
    throw new Error("A contact needs a name, company, role, phone, or email.");
  }
  const index = contacts.findIndex((item) => item.id === contact.id);
  if (index < 0) return [...contacts, contact];
  const next = contacts.slice();
  next[index] = { ...contacts[index], ...contact };
  return next;
}

export function removeProjectContact<T extends Contact>(contacts: T[], contactId: string): T[] {
  return contacts.filter((item) => item.id !== contactId);
}
