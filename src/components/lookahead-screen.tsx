"use client";

import { DateFlag, Field, PageIntro, SelectField, TextField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankSchedule } from "@/lib/data/factories";
import { deleteSchedule, getProject, listSchedule, saveSchedule } from "@/lib/data/repo";
import { formatDay, todayISO } from "@/lib/domain/dates";
import { lookaheadItems, scheduleSpan } from "@/lib/domain/lookahead";
import type { ScheduleConfirmation, ScheduleDate, ScheduleKind } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { use, useState } from "react";
import { toast } from "sonner";

export function LookaheadScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const schedule = useLiveQuery(() => listSchedule(id), [id]);
  const [weeks, setWeeks] = useState<2 | 6>(2);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !schedule) return <PageFallback />;
  if (project === null) {
    return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
  }

  const shown = lookaheadItems(schedule, today, weeks);

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="lookahead" />
      <PageIntro
        eyebrow={project.name}
        title="Look-ahead"
        description="Dates with a start and an end. Confirmed, tentative, or needs verification, plus where the date came from and the day you last checked it."
      />
      <div className="grid grid-cols-2 gap-2">
        {([2, 6] as const).map((option) => (
          <Button key={option} type="button" variant={weeks === option ? "default" : "outline"} onClick={() => setWeeks(option)}>
            {option}-week
          </Button>
        ))}
      </div>
      <ScheduleEditor projectId={id} />
      {shown.length === 0 ? (
        <EmptyState title={`Nothing in the next ${weeks} weeks`} body="Add a date with a start and an end. A one-day item uses the same day for both." />
      ) : (
        <ul className="grid gap-3">
          {shown.map((item) => {
            const span = scheduleSpan(item);
            return (
              <li key={item.id}>
                <ScheduleEditor projectId={id} existing={item} />
                <p className="sr-only">
                  {item.label} {formatDay(span.start, today)} to {formatDay(span.end, today)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScheduleEditor({ projectId, existing }: { projectId: string; existing?: ScheduleDate }) {
  const today = todayISO();
  const [label, setLabel] = useState(existing?.label ?? "");
  const [date, setDate] = useState(existing?.date ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate || existing?.date || today);
  const [confirmation, setConfirmation] = useState<ScheduleConfirmation>(existing?.confirmation ?? "tentative");
  const [kind, setKind] = useState<ScheduleKind>(existing?.kind ?? "other");
  const [source, setSource] = useState(existing?.source ?? "");
  const [asOf, setAsOf] = useState(existing?.asOf ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setFormError(null);
    try {
      await saveSchedule(
        blankSchedule(projectId, {
          ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
          label,
          date,
          endDate: endDate || date,
          confirmation,
          kind,
          source,
          asOf,
          notes,
        }),
      );
      if (!existing) {
        setLabel("");
        setSource("");
        setAsOf("");
        setNotes("");
      }
      toast.success("Date saved on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the date");
    }
  }

  return (
    <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl font-bold">{existing ? existing.label || "Date" : "Add a date"}</h2>
        {existing ? <DateFlag value={existing.confirmation} /> : null}
      </div>
      <Field label="Label">
        <TextField value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Inspection, delivery, meeting" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start">
          <TextField type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="End">
          <TextField type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
      </div>
      <Field label="Kind">
        <SelectField value={kind} onChange={(event) => setKind(event.target.value as ScheduleKind)}>
          <option value="inspection">Inspection</option>
          <option value="delivery">Delivery</option>
          <option value="meeting">Meeting</option>
          <option value="milestone">Milestone</option>
          <option value="other">Other</option>
        </SelectField>
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="How sure this date is">
        {(
          [
            ["tentative", "Tentative"],
            ["confirmed", "Confirmed"],
            ["needs-verification", "Needs verification"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={confirmation === value}
            onClick={() => setConfirmation(value)}
            className={
              confirmation === value
                ? "h-12 rounded-lg bg-teal text-sm font-bold text-teal-ink"
                : "h-12 rounded-lg bg-background text-sm font-bold ring-1 ring-border"
            }
          >
            {text}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source" hint="Leave blank if you do not have one.">
          <TextField value={source} onChange={(event) => setSource(event.target.value)} placeholder="Who or what said this" />
        </Field>
        <Field label="As of" hint="The day you last checked this date.">
          <TextField type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <TextField value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <InlineError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()}>
          {existing ? "Save date" : "Add date"}
        </Button>
        {existing ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void deleteSchedule(existing.id).then(() => toast.success("Date removed"));
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
