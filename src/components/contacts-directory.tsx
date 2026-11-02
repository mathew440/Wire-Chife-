"use client";

import { AreaField, ConfirmDialog, Field, PageIntro, SampleBadge, TextField } from "@/components/bits";
import { ContactCard } from "@/components/contact-card";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankContact } from "@/lib/data/factories";
import { listProjects, saveProject } from "@/lib/data/repo";
import type { Contact, Project } from "@/lib/data/types";
import {
  GENERAL_CONTACT_GROUP_ID,
  contactCountLabel,
  groupContactsByJob,
  removeProjectContact,
  upsertProjectContact,
  type JobContactGroup,
} from "@/lib/domain/contact-groups";
import { contactsJobPath } from "@/lib/routes";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { AppLink as Link } from "@/components/app-link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export function ContactsDirectory() {
  const { status, error } = useDbReady();
  const projects = useLiveQuery(() => (status === "ready" ? listProjects() : undefined), [status]);
  const [query, setQuery] = useState("");

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !projects) return <PageFallback />;

  const needle = query.trim().toLowerCase();
  const groups = groupContactsByJob(projects, { showEmptyGeneral: projects.some((project) => project.id.trim()) });
  const shown = groups.filter((group) => groupMatches(group, needle));

  return (
    <div className="grid min-w-0 gap-5">
      <PageIntro
        eyebrow="All jobs"
        title="Contacts"
        description="Pick a job to see the people saved on it. A new contact added there stays on that job."
      />
      <Field label="Find">
        <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job, name, company, or phone" />
      </Field>
      {projects.length === 0 ? (
        <EmptyState
          title="No jobs on this device"
          body="Add a job first. Contacts are saved on that job, and anyone not tied to a job shows up under No job / General."
          action={
            <Button nativeButton={false} render={<Link href="/projects/new" />}>
              New job
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState title="No match" body="Try a different job, name, company, or phone." />
      ) : (
        <ul className="grid min-w-0 gap-3">
          {shown.map((group) => (
            <li key={group.id} className="min-w-0">
              <JobRow group={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRow({ group }: { group: JobContactGroup }) {
  const count = group.contacts.length;
  return (
    <Link
      href={contactsJobPath(group.id)}
      aria-label={`${group.name}, ${contactCountLabel(count)}`}
      className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl leading-tight font-bold break-words [overflow-wrap:anywhere]">{group.name}</span>
        {group.jobNumber ? (
          <span className="mt-1 block text-sm break-words text-muted-foreground [overflow-wrap:anywhere]">Job {group.jobNumber}</span>
        ) : null}
      </span>
      <span className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-center">
        <span className="block font-display text-2xl leading-none font-bold">{count}</span>
        <span className="mt-1 block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {count === 1 ? "contact" : "contacts"}
        </span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-teal" aria-hidden />
    </Link>
  );
}

export function JobContacts({ projectId }: { projectId: string }) {
  const { status, error } = useDbReady();
  const projects = useLiveQuery(() => (status === "ready" ? listProjects() : undefined), [status]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !projects) return <PageFallback />;

  const isGeneral = projectId === GENERAL_CONTACT_GROUP_ID;
  const project = isGeneral ? undefined : projects.find((item) => item.id === projectId);
  const group = groupContactsByJob(projects, { showEmptyGeneral: isGeneral }).find((item) => item.id === projectId);

  if (!isGeneral && !project) {
    return (
      <EmptyState
        title="This job is not on this device"
        body="It may have been removed."
        action={
          <Button nativeButton={false} render={<Link href="/contacts" />}>
            Back to jobs
          </Button>
        }
      />
    );
  }
  if (!group) {
    return (
      <EmptyState
        title="No contacts without a job"
        body="Everyone saved on a job is listed under that job."
        action={
          <Button nativeButton={false} render={<Link href="/contacts" />}>
            Back to jobs
          </Button>
        }
      />
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = group.contacts.filter((contact) => contactMatches(contact, needle));
  const canAdd = !isGeneral && Boolean(project);

  function updateDraft(partial: Partial<Contact>) {
    setDraft((current) => (current ? { ...current, ...partial } : current));
  }

  function startAdd() {
    setDraft(blankContact());
    setEditing(false);
    setFormError(null);
  }

  function startEdit(contact: Contact) {
    setDraft({ ...contact });
    setEditing(true);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const owner = projectForContact(projects ?? [], projectId, editing ? draft.id : undefined);
    if (!owner) {
      setFormError("Save this person on a job. Open that job and add them there.");
      return;
    }
    setFormError(null);
    try {
      await saveProject({ ...owner, contacts: upsertProjectContact(owner.contacts ?? [], draft) });
      toast.success(editing ? "Contact saved on this device" : "Contact added on this job");
      setDraft(null);
      setEditing(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the contact");
    }
  }

  async function removeContact() {
    if (!pendingDelete) return;
    const owner = projectForContact(projects ?? [], projectId, pendingDelete.id);
    setPendingDelete(null);
    if (!owner) {
      toast.error("That contact is not on a job on this device.");
      return;
    }
    try {
      await saveProject({ ...owner, contacts: removeProjectContact(owner.contacts ?? [], pendingDelete.id) });
      if (draft?.id === pendingDelete.id) {
        setDraft(null);
        setEditing(false);
      }
      toast.success("Contact removed");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove the contact");
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <Button variant="outline" className="w-full sm:w-fit" nativeButton={false} render={<Link href="/contacts" />}>
        Back to jobs
      </Button>
      <PageIntro
        eyebrow={isGeneral ? "Not on a job" : group.jobNumber ? `Job ${group.jobNumber}` : "Job"}
        title={group.name}
        description={
          isGeneral
            ? "These people are not saved on a job. Add someone from inside a job and they stay on that job."
            : "People saved on this job. Phone and email open on this phone."
        }
      />
      {project?.isSample ? <SampleBadge /> : null}
      {canAdd && !draft ? (
        <Button type="button" className="w-full sm:w-fit" onClick={startAdd}>
          Add contact
        </Button>
      ) : null}
      {draft ? (
        <form onSubmit={onSubmit} className="grid min-w-0 gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
          <h2 className="font-display text-2xl font-bold break-words">{editing ? "Edit contact" : "New contact"}</h2>
          {!isGeneral ? (
            <p className="text-sm break-words text-muted-foreground [overflow-wrap:anywhere]">Saved on {group.name}.</p>
          ) : null}
          <Field label="Name">
            <TextField value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Sam Sample" />
          </Field>
          <Field label="Company">
            <TextField
              value={draft.company}
              onChange={(event) => updateDraft({ company: event.target.value })}
              placeholder="Sample Owners LLC"
            />
          </Field>
          <Field label="Role">
            <AreaField
              value={draft.role}
              onChange={(event) => updateDraft({ role: event.target.value })}
              className="min-h-20 max-w-full [overflow-wrap:anywhere]"
              placeholder="Owner"
            />
          </Field>
          <Field label="Phone">
            <TextField type="tel" value={draft.phone} onChange={(event) => updateDraft({ phone: event.target.value })} placeholder="555-0100" />
          </Field>
          <Field label="Email">
            <TextField
              type="email"
              value={draft.email}
              onChange={(event) => updateDraft({ email: event.target.value })}
              placeholder="sam@example.com"
            />
          </Field>
          <InlineError message={formError} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" className="w-full">
              Save contact
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setDraft(null);
                setEditing(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {group.contacts.length > 0 ? (
        <Field label={isGeneral ? "Find" : "Find on this job"}>
          <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, email, or phone" />
        </Field>
      ) : null}
      {group.contacts.length === 0 ? (
        <EmptyState
          title={isGeneral ? "No contacts without a job" : "No contacts on this job"}
          body={isGeneral ? "Everyone saved on a job is listed under that job." : "Add a contact and it stays on this job."}
        />
      ) : shown.length === 0 ? (
        <EmptyState title="No match" body="Try a different name, company, or phone." />
      ) : (
        <ul className="grid min-w-0 gap-4">
          {shown.map((contact) => (
            <li key={contact.id} className="grid min-w-0 gap-2">
              <ContactCard contact={contact} />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => startEdit(contact)}>
                  Edit
                </Button>
                <Button type="button" variant="destructive" className="w-full" onClick={() => setPendingDelete(contact)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Remove this contact?"
        body={isGeneral ? "This person comes off the list. Jobs on this device stay." : "This person comes off this job. The job stays."}
        confirmLabel="Remove contact"
        onConfirm={() => {
          void removeContact();
        }}
      />
    </div>
  );
}

function projectForContact(projects: Project[], groupId: string, contactId?: string): Project | undefined {
  if (groupId !== GENERAL_CONTACT_GROUP_ID) return projects.find((project) => project.id === groupId);
  if (!contactId) return undefined;
  return projects.find(
    (project) => !(project.id ?? "").trim() && (project.contacts ?? []).some((contact) => contact.id === contactId),
  );
}

function groupMatches(group: JobContactGroup, needle: string): boolean {
  if (!needle) return true;
  const haystack = [group.name, group.jobNumber, ...group.contacts.flatMap(contactHaystack)].join(" ").toLowerCase();
  return haystack.includes(needle);
}

function contactMatches(contact: Contact, needle: string): boolean {
  if (!needle) return true;
  return contactHaystack(contact).join(" ").toLowerCase().includes(needle);
}

function contactHaystack(contact: Contact): string[] {
  return [contact.name, contact.company, contact.email, contact.role, contact.phone];
}
