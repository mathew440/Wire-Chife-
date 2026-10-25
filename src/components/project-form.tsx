"use client";

import { ConfirmDialog, Field, PageIntro, ProjectStatusPill, SampleBadge, SelectField, TextField } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankContact, blankProject } from "@/lib/data/factories";
import { deleteProject, getProject, saveProject } from "@/lib/data/repo";
import type { Project, ProjectStatus } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

export function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectForm projectId={id} />;
}

export function ProjectForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const { status, error } = useDbReady();
  const existing = useLiveQuery(async () => {
    if (!projectId || status !== "ready") return undefined;
    return (await getProject(projectId)) ?? null;
  }, [projectId, status]);
  const [created] = useState<Project | null>(() => (projectId ? null : blankProject()));
  const [edits, setEdits] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (projectId && (status !== "ready" || existing === undefined)) return <PageFallback />;
  if (projectId && existing === null) {
    return (
      <EmptyState title="This job is not on this device" body="It may have been removed." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />
    );
  }
  const source = (projectId ? existing : created) as Project;
  const draft = edits ?? source;

  function update(partial: Partial<Project>) {
    setEdits((current) => ({ ...(current ?? source), ...partial }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError("A job needs a name.");
      return;
    }
    setFormError(null);
    try {
      const saved = await saveProject({
        ...draft,
        name: draft.name.trim(),
        contacts: draft.contacts.filter(
          (contact) => contact.name.trim() || contact.role.trim() || contact.phone.trim() || contact.email.trim() || contact.company.trim(),
        ),
      });
      toast.success("Job saved on this device");
      router.push(`/projects/${saved.id}`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto grid max-w-3xl gap-5">
      <PageIntro
        eyebrow={projectId ? "Edit job" : "New job"}
        title={projectId ? draft.name || "Edit job" : "New job"}
        description="Name, job number, GC, location, and the people you call. This job will not share reports or files with any other job."
      />
      <div className="flex flex-wrap gap-2">
        {draft.isSample ? <SampleBadge /> : null}
        <ProjectStatusPill status={draft.status} />
      </div>
      <Field label="Job name">
        <TextField value={draft.name} onChange={(event) => update({ name: event.target.value })} placeholder="Sample Job A" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job number">
          <TextField value={draft.jobNumber} onChange={(event) => update({ jobNumber: event.target.value })} placeholder="1001" />
        </Field>
        <Field label="Status">
          <SelectField value={draft.status} onChange={(event) => update({ status: event.target.value as ProjectStatus })}>
            <option value="unverified">Needs verification</option>
            <option value="bidding">Bidding</option>
            <option value="active">Active</option>
            <option value="punch">Punch</option>
            <option value="on-hold">On hold</option>
            <option value="complete">Complete</option>
          </SelectField>
        </Field>
      </div>
      <Field label="General contractor">
        <TextField value={draft.gc} onChange={(event) => update({ gc: event.target.value })} placeholder="GC name" />
      </Field>
      <Field label="Location">
        <TextField value={draft.location} onChange={(event) => update({ location: event.target.value })} placeholder="City, OH" />
      </Field>
      <Field label="What this job is">
        <TextField value={draft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Scope of work" />
      </Field>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Contacts</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => update({ contacts: [...draft.contacts, blankContact()] })}
          >
            Add contact
          </Button>
        </div>
        {draft.contacts.length === 0 ? <p className="text-sm text-muted-foreground">Superintendent, owner rep, inspector.</p> : null}
        {draft.contacts.map((contact, index) => (
          <div key={contact.id} className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-border">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Name">
                <TextField
                  value={contact.name}
                  onChange={(event) => {
                    const contacts = draft.contacts.slice();
                    contacts[index] = { ...contact, name: event.target.value };
                    update({ contacts });
                  }}
                />
              </Field>
              <Field label="Company">
                <TextField
                  value={contact.company}
                  onChange={(event) => {
                    const contacts = draft.contacts.slice();
                    contacts[index] = { ...contact, company: event.target.value };
                    update({ contacts });
                  }}
                  placeholder="Company name"
                />
              </Field>
              <Field label="Role">
                <TextField
                  value={contact.role}
                  onChange={(event) => {
                    const contacts = draft.contacts.slice();
                    contacts[index] = { ...contact, role: event.target.value };
                    update({ contacts });
                  }}
                  placeholder="Superintendent"
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Phone">
                <TextField
                  type="tel"
                  value={contact.phone}
                  onChange={(event) => {
                    const contacts = draft.contacts.slice();
                    contacts[index] = { ...contact, phone: event.target.value };
                    update({ contacts });
                  }}
                />
              </Field>
              <Field label="Email">
                <TextField
                  type="email"
                  value={contact.email}
                  onChange={(event) => {
                    const contacts = draft.contacts.slice();
                    contacts[index] = { ...contact, email: event.target.value };
                    update({ contacts });
                  }}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => update({ contacts: draft.contacts.filter((item) => item.id !== contact.id) })}
            >
              Remove contact
            </Button>
          </div>
        ))}
      </div>
      <InlineError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save job</Button>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href={projectId ? `/projects/${projectId}` : "/"} />}>
          Cancel
        </Button>
        {projectId ? (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete job
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this job?"
        body="Reports, open items, submittals, RFIs, photos, estimates, dates, crew assignments, and files for this job come off the device. Other jobs stay."
        confirmLabel="Delete job"
        onConfirm={() => {
          if (!projectId) return;
          void deleteProject(projectId).then(() => {
            toast.success("Job removed from this device");
            router.push("/");
          });
        }}
      />
    </form>
  );
}
