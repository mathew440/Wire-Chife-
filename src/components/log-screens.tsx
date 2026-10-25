"use client";

import { Field, PageIntro, SelectField, TextField, AreaField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankLogItem } from "@/lib/data/factories";
import { deleteLogItem, getLogItem, getProject, listLogItems, saveLogItem } from "@/lib/data/repo";
import { duePhrase, formatDay, todayISO } from "@/lib/domain/dates";
import { isClosedLog, isOverdueLog, LOG_STATUS_OPTIONS, logStatusLabel } from "@/lib/domain/logs";
import type { LogItem, LogKind, LogStatus } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

export function LogList({ params, kind }: { params: Promise<{ id: string }>; kind: LogKind }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const items = useLiveQuery(() => listLogItems(id, kind), [id, kind]);
  const [statusFilter, setStatusFilter] = useState<LogStatus | "all">("all");
  const [court, setCourt] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const noun = kind === "rfi" ? "RFI" : "Submittal";
  const path = kind === "rfi" ? "rfis" : "submittals";

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !items) return <PageFallback />;
  if (project === null) return <Missing />;

  const courts = [...new Set(items.map((item) => item.ballInCourt).filter(Boolean))].sort();
  const shown = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (court && item.ballInCourt !== court) return false;
    if (overdueOnly && !isOverdueLog(item, today)) return false;
    return true;
  });

  async function changeStatus(item: LogItem, next: LogStatus) {
    try {
      await saveLogItem({ ...item, status: next });
      toast.success("Status saved on this device");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the status");
    }
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current={kind === "rfi" ? "rfis" : "submittals"} />
      <PageIntro
        eyebrow={project.name}
        title={kind === "rfi" ? "RFI log" : "Submittal log"}
        description="Number, spec section, dates, status, and who has it. A due date you leave blank is not treated as overdue."
        actions={
          <Button nativeButton={false} render={<Link href={`/projects/${id}/${path}/new`} />}>
            New {noun}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status">
          <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LogStatus | "all")}>
            <option value="all">All statuses</option>
            {LOG_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Ball in court">
          <SelectField value={court} onChange={(event) => setCourt(event.target.value)}>
            <option value="">Anyone</option>
            {courts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>
        </Field>
        <div className="flex items-end">
          <Button type="button" variant={overdueOnly ? "default" : "outline"} onClick={() => setOverdueOnly((value) => !value)}>
            Overdue only
          </Button>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={`No ${kind === "rfi" ? "RFIs" : "submittals"} in this list`} body="Add a row when you send one, or clear the filters." />
      ) : (
        <ul className="grid gap-3">
          {shown.map((item) => {
            const overdue = isOverdueLog(item, today);
            return (
              <li key={item.id} className={overdue ? "rounded-xl bg-orange/10 ring-2 ring-orange" : "rounded-xl bg-card ring-1 ring-border"}>
                <div className="grid gap-3 px-4 py-4">
                  <Link href={`/projects/${id}/${path}/${item.id}`} className="grid gap-1">
                    <span className="font-display text-2xl font-bold">{item.number || "No number"}</span>
                    <span className="text-base">{item.description || "No description"}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.specSection ? `Spec ${item.specSection} · ` : ""}
                      {item.ballInCourt || "No ball in court"}
                      {item.dueDate ? ` · ${formatDay(item.dueDate, today)} · ${duePhrase(item.dueDate, today)}` : " · No due date"}
                    </span>
                    {overdue ? <span className="text-sm font-bold text-orange">OVERDUE</span> : null}
                  </Link>
                  <Field label="Quick status">
                    <SelectField
                      aria-label={`Status for ${item.number || item.description || noun}`}
                      value={item.status}
                      onChange={(event) => void changeStatus(item, event.target.value as LogStatus)}
                    >
                      {LOG_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LogEditor({ params, kind }: { params: Promise<{ id: string; itemId: string }>; kind: LogKind }) {
  const { id, itemId } = use(params);
  const isNew = itemId === "new";
  const router = useRouter();
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const existing = useLiveQuery(async () => {
    if (isNew || status !== "ready") return undefined;
    return (await getLogItem(itemId)) ?? null;
  }, [isNew, itemId, status]);
  const [created] = useState<LogItem | null>(() => (isNew ? blankLogItem(id, kind) : null));
  const [edits, setEdits] = useState<LogItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const noun = kind === "rfi" ? "RFI" : "Submittal";
  const path = kind === "rfi" ? "rfis" : "submittals";

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined) return <PageFallback />;
  if (project === null) return <Missing />;
  if (!isNew) {
    if (existing === undefined) return <PageFallback />;
    if (existing === null || existing.projectId !== id || existing.kind !== kind) {
      return (
        <EmptyState
          title={`This ${noun} is not on this job`}
          body="Logs stay on the job they were written for."
          action={<Button nativeButton={false} render={<Link href={`/projects/${id}/${path}`} />}>Back to the log</Button>}
        />
      );
    }
  }
  const source = (isNew ? created : existing) as LogItem;
  const draft = edits ?? source;
  const overdue = isOverdueLog(draft, today);

  function update(partial: Partial<LogItem>) {
    setEdits((current) => ({ ...(current ?? source), ...partial }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const saved = await saveLogItem(draft);
      toast.success(`${noun} saved on this device`);
      if (isNew) router.replace(`/projects/${id}/${path}/${saved.id}`);
      else setEdits(saved);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <ProjectTabs projectId={id} current={kind === "rfi" ? "rfis" : "submittals"} />
      <PageIntro eyebrow={project.name} title={isNew ? `New ${noun}` : draft.number || noun} description={logStatusLabel(draft.status)} />
      {overdue && !isClosedLog(draft.status) ? <p className="text-sm font-bold text-orange">OVERDUE</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Number">
          <TextField value={draft.number} onChange={(event) => update({ number: event.target.value })} placeholder={kind === "rfi" ? "RFI-1" : "001"} />
        </Field>
        <Field label="Spec section">
          <TextField value={draft.specSection} onChange={(event) => update({ specSection: event.target.value })} placeholder="26 00 00" />
        </Field>
      </div>
      <Field label="Description">
        <TextField value={draft.description} onChange={(event) => update({ description: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sent">
          <TextField type="date" value={draft.sentDate ?? ""} onChange={(event) => update({ sentDate: event.target.value || null })} />
        </Field>
        <Field label="Due" hint="Leave blank if there is no due date.">
          <TextField type="date" value={draft.dueDate ?? ""} onChange={(event) => update({ dueDate: event.target.value || null })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <SelectField value={draft.status} onChange={(event) => update({ status: event.target.value as LogStatus })}>
            {LOG_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Ball in court">
          <TextField value={draft.ballInCourt} onChange={(event) => update({ ballInCourt: event.target.value })} placeholder="Who has it" />
        </Field>
      </div>
      <Field label="Linked contact" hint="Contacts are the people saved on this job.">
        <SelectField value={draft.contactId ?? ""} onChange={(event) => update({ contactId: event.target.value || null })}>
          <option value="">None</option>
          {project.contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {[contact.name, contact.company, contact.email].filter(Boolean).join(" · ") || "Unnamed contact"}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Notes">
        <AreaField value={draft.notes} onChange={(event) => update({ notes: event.target.value })} />
      </Field>
      <InlineError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/${path}`} />}>
          Back
        </Button>
        {!isNew ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void deleteLogItem(draft.id).then(() => {
                toast.success(`${noun} removed`);
                router.push(`/projects/${id}/${path}`);
              });
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Missing() {
  return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
}
