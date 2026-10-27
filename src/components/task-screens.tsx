"use client";

import { AreaField, ConfirmDialog, DateFlag, Field, PageIntro, SampleBadge, SelectField, TaskStatusPill, TextField, ConfirmationToggle } from "@/components/bits";
import { StructuredText } from "@/components/structured-text";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankAttachment, blankTask } from "@/lib/data/factories";
import {
  deleteTask,
  getProject,
  getTask,
  listAttachments,
  listPeople,
  listTasks,
  saveAttachment,
  saveTask,
} from "@/lib/data/repo";
import { isOverdueTask } from "@/lib/domain/dashboard";
import { duePhrase, formatDay, todayISO } from "@/lib/domain/dates";
import { prepareUpload } from "@/lib/files/prepare";
import type { Task, TaskStatus } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

export function TaskList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const tasks = useLiveQuery(() => listTasks(id), [id]);
  const [filter, setFilter] = useState<"open" | "overdue" | "done" | "all">("open");

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !tasks) return <PageFallback />;
  if (project === null) return <Missing />;

  const shown = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "done") return task.status === "done";
    if (filter === "overdue") return isOverdueTask(task, today);
    return task.status !== "done";
  });

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="tasks" />
      <PageIntro
        eyebrow={project.name}
        title="Open items"
        description="Owner, due date, status, and the evidence that supports it. A due date stays tentative until you confirm it."
        actions={<Button nativeButton={false} render={<Link href={`/projects/${id}/tasks/new`} />}>New item</Button>}
      />
      <div className="flex flex-wrap gap-2">
        {(["open", "overdue", "done", "all"] as const).map((key) => (
          <Button key={key} type="button" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {key === "open" ? "Open" : key === "overdue" ? "Overdue" : key === "done" ? "Done" : "All"}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nothing in this list" body="Add an item with the person who owns it and what backs the status." />
      ) : (
        <ul className="grid gap-3">
          {shown.map((task) => (
            <li key={task.id}>
              <Link href={`/projects/${id}/tasks/${task.id}`} className="grid gap-2 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-2xl font-bold">{task.title}</span>
                  <TaskStatusPill status={task.status} />
                  {task.isSample ? <SampleBadge /> : null}
                  {isOverdueTask(task, today) ? <span className="text-sm font-bold text-orange">OVERDUE</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {task.owner || "No owner"}
                  {task.dueDate ? ` · ${formatDay(task.dueDate, today)} · ${duePhrase(task.dueDate, today)}` : " · No due date"}
                </span>
                {task.dueDate ? <DateFlag value={task.dueConfirmation} /> : null}
                {task.evidence ? (
                  <div className="text-[17px] leading-[1.6]">
                    <p>Source</p>
                    <StructuredText text={task.evidence} />
                  </div>
                ) : (
                  <p className="text-[17px] leading-[1.6]">No source yet</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaskEditor({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = use(params);
  const isNew = taskId === "new";
  const router = useRouter();
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const existing = useLiveQuery(async () => {
    if (isNew || status !== "ready") return undefined;
    return (await getTask(taskId)) ?? null;
  }, [isNew, taskId, status]);
  const people = useLiveQuery(() => listPeople(), []);
  const files = useLiveQuery(() => listAttachments(id), [id]);
  const [created] = useState<Task | null>(() => (isNew ? blankTask(id) : null));
  const [edits, setEdits] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !people || !files) return <PageFallback />;
  if (project === null) return <Missing />;
  if (!isNew) {
    if (existing === undefined) return <PageFallback />;
    if (existing === null || existing.projectId !== id) {
      return <EmptyState title="This item is not on this job" body="Open items do not cross jobs." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/tasks`} />}>Back to items</Button>} />;
    }
  }
  const source = (isNew ? created : existing) as Task;
  const draft = edits ?? source;
  const linked = files.filter((file) => file.parentType === "task" && file.parentId === draft.id);

  function update(partial: Partial<Task>) {
    setEdits((current) => ({ ...(current ?? source), ...partial }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    try {
      const saved = await saveTask({ ...draft, dueDate: draft.dueDate || null });
      toast.success("Item saved on this device");
      if (isNew) router.replace(`/projects/${id}/tasks/${saved.id}`);
      else setEdits(saved);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <ProjectTabs projectId={id} current="tasks" />
      <PageIntro
        eyebrow={project.name}
        title={isNew ? "New open item" : draft.title || "Open item"}
        description="The evidence field is the source: a drawing, an email, or the person who said it."
      />
      <div className="flex flex-wrap gap-2">
        <TaskStatusPill status={draft.status} />
        {draft.isSample ? <SampleBadge /> : null}
        {draft.dueDate && isOverdueTask(draft, today) ? <span className="text-sm font-bold text-orange">OVERDUE</span> : null}
      </div>
      <Field label="Title">
        <TextField value={draft.title} onChange={(event) => update({ title: event.target.value })} required />
      </Field>
      <Field label="Details">
        <AreaField value={draft.details} onChange={(event) => update({ details: event.target.value })} />
      </Field>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Owner">
          <TextField list="owners" value={draft.owner} onChange={(event) => update({ owner: event.target.value })} placeholder="Who owns this" />
          <datalist id="owners">
            {people.map((person) => (
              <option key={person.id} value={person.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <SelectField value={draft.status} onChange={(event) => update({ status: event.target.value as TaskStatus })}>
            <option value="open">Open</option>
            <option value="in-progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </SelectField>
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Due date" hint="Leave blank if there is no date.">
          <TextField type="date" value={draft.dueDate ?? ""} onChange={(event) => update({ dueDate: event.target.value || null })} />
        </Field>
        <Field label="Due date status">
          <ConfirmationToggle value={draft.dueConfirmation} onChange={(dueConfirmation) => update({ dueConfirmation })} />
        </Field>
      </div>
      <Field label="Evidence / source" hint="What document or person supports this status? Required before you can mark it done.">
        <AreaField value={draft.evidence} onChange={(event) => update({ evidence: event.target.value })} className="min-h-32 border-l-4 border-l-warn" placeholder="Drawing E-4, or Pat Coleman on site" />
      </Field>
      {!draft.evidence.trim() ? <p className="text-sm font-bold text-orange">No source yet.</p> : null}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl font-bold">Files on this item</h2>
        {isNew ? <p className="text-sm text-muted-foreground">Save the item first, then attach a photo or PDF.</p> : (
          <input
            type="file"
            accept="image/*,application/pdf"
            className="block h-12 w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-teal file:px-4 file:font-bold file:text-teal-ink"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void prepareUpload(file)
                .then((prepared) =>
                  saveAttachment(
                    blankAttachment(id, {
                      parentType: "task",
                      parentId: draft.id,
                      fileName: prepared.fileName,
                      mimeType: prepared.mimeType,
                      blob: prepared.blob,
                    }),
                  ),
                )
                .then(() => toast.success("File saved on this item"))
                .catch((caught: unknown) => setFormError(caught instanceof Error ? caught.message : "Could not attach"));
            }}
          />
        )}
        {linked.map((file) => (
          <Link key={file.id} className="font-semibold text-teal" href={`/projects/${id}/files/${file.id}`}>
            {file.fileName}
          </Link>
        ))}
      </section>
      <InlineError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save item</Button>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/tasks`} />}>
          Back
        </Button>
        {!isNew ? (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        body="It comes off this job only."
        confirmLabel="Delete item"
        onConfirm={() => {
          void deleteTask(draft.id).then(() => {
            toast.success("Item removed");
            router.push(`/projects/${id}/tasks`);
          });
        }}
      />
    </form>
  );
}

function Missing() {
  return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
}
