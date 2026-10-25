"use client";

import { AreaField, Field, PageIntro, TextField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { blankLaborBudget, blankTimeEntry } from "@/lib/data/factories";
import {
  deleteLaborBudget,
  deleteTimeEntry,
  getProject,
  listLaborBudgets,
  listReports,
  listTimeEntries,
  saveLaborBudget,
  saveTimeEntry,
} from "@/lib/data/repo";
import type { LaborBudget, TimeEntry } from "@/lib/data/types";
import { formatDay, todayISO } from "@/lib/domain/dates";
import { formatHours, summarizeHours } from "@/lib/domain/hours";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

const RULE =
  "Hours you type here are used first. On a day with no time entry, hours from that day's report are added. A day is never counted twice. Crew assignments are not added.";

export function HoursScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? ((await getProject(id)) ?? null) : undefined), [id, status]);
  const budgets = useLiveQuery(() => (status === "ready" ? listLaborBudgets(id) : undefined), [id, status]);
  const entries = useLiveQuery(() => (status === "ready" ? listTimeEntries(id) : undefined), [id, status]);
  const reports = useLiveQuery(() => (status === "ready" ? listReports(id) : undefined), [id, status]);
  const [budget, setBudget] = useState<LaborBudget>(() => blankLaborBudget(id));
  const [editingBudget, setEditingBudget] = useState(false);
  const [allowedText, setAllowedText] = useState("");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [entry, setEntry] = useState<TimeEntry>(() => blankTimeEntry(id));
  const [hoursText, setHoursText] = useState("");
  const [editingEntry, setEditingEntry] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !budgets || !entries || !reports) return <PageFallback />;
  if (project === null) {
    return (
      <EmptyState
        title="This job is not on this device"
        body="It may have been removed, or this link is from another phone."
        action={
          <Button nativeButton={false} render={<Link href="/" />}>
            Back to jobs
          </Button>
        }
      />
    );
  }

  const summary = summarizeHours({ budgets, entries, reports });
  const percent = summary.percent;
  const barWidth = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const warn = percent != null && percent >= 80;
  const over = percent != null && percent > 100;

  function clearBudget() {
    setBudget(blankLaborBudget(id));
    setAllowedText("");
    setEditingBudget(false);
    setBudgetError(null);
  }

  function clearEntry() {
    setEntry(blankTimeEntry(id));
    setHoursText("");
    setEditingEntry(false);
    setEntryError(null);
  }

  async function onBudget(event: FormEvent) {
    event.preventDefault();
    setBudgetError(null);
    const allowedHours = Number(allowedText);
    if (allowedText.trim() === "" || !Number.isFinite(allowedHours)) {
      setBudgetError("Enter the hours allowed.");
      return;
    }
    try {
      await saveLaborBudget({ ...budget, allowedHours });
      toast.success("Hours allowed saved on this device");
      clearBudget();
    } catch (caught) {
      setBudgetError(caught instanceof Error ? caught.message : "Could not save hours allowed");
    }
  }

  async function onEntry(event: FormEvent) {
    event.preventDefault();
    setEntryError(null);
    const hours = Number(hoursText);
    if (hoursText.trim() === "" || !Number.isFinite(hours)) {
      setEntryError("Enter the hours worked.");
      return;
    }
    try {
      await saveTimeEntry({ ...entry, hours });
      toast.success(editingEntry ? "Hours saved on this device" : "Hours added on this device");
      clearEntry();
    } catch (caught) {
      setEntryError(caught instanceof Error ? caught.message : "Could not save the hours");
    }
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="hours" />
      <PageIntro
        eyebrow={project.name}
        title="Hours"
        description="Hours allowed is the budget. Hours used adds what you type here, then manpower from a daily report only on days you did not type hours."
      />

      <Card className="bg-card text-base">
        <CardContent className="grid gap-3">
          <h2 className="font-display text-2xl font-bold">On this job so far</h2>
          <p className="text-sm text-muted-foreground">{RULE}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Stat label="Hours allowed" value={summary.allowed == null ? "Not set" : formatHours(summary.allowed)} />
            <Stat label="Hours used" value={formatHours(summary.used)} />
            <Stat label="Hours left" value={summary.remaining == null ? "Set hours allowed" : formatHours(summary.remaining)} warn={over} />
            <Stat label="Percent used" value={percent == null ? "Set hours allowed" : `${formatHours(percent)}%`} warn={warn} />
          </dl>
          {percent != null ? (
            <div className="grid gap-1">
              <div className="h-4 overflow-hidden rounded-full bg-background ring-1 ring-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, percent))} aria-label="Percent of hours allowed that are used">
                <div className={warn ? "h-full bg-orange" : "h-full bg-teal"} style={{ width: `${barWidth}%` }} />
              </div>
              {over ? <p className="text-sm font-bold text-orange">Over the hours allowed</p> : null}
              {warn && !over ? <p className="text-sm font-bold text-orange">80% or more of the hours allowed</p> : null}
            </div>
          ) : null}
          <p className="text-sm">
            {formatHours(summary.fromTimeEntries)} hours typed here. {formatHours(summary.fromReports)} hours from daily reports on days with no time entry.
          </p>
          {summary.burnPerWeek != null ? (
            <p className="text-sm">About {formatHours(summary.burnPerWeek)} hours a week, from the days that have hours.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Hours per week shows up after hours are saved on two different days.</p>
          )}
          {summary.reportDaysSkipped.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Left out the daily report on {summary.reportDaysSkipped.map((date) => formatDay(date, today)).join(", ")} because hours were typed for that day.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <form onSubmit={onBudget} className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 className="font-display text-2xl font-bold">{editingBudget ? "Edit hours allowed" : "Hours allowed"}</h2>
        <p className="text-sm text-muted-foreground">Leave the name as Total, or split the budget by phase. Nothing is saved until you tap Save.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phase">
            <TextField value={budget.label} onChange={(event) => setBudget((current) => ({ ...current, label: event.target.value }))} placeholder="Total" />
          </Field>
          <Field label="Hours allowed">
            <TextField inputMode="decimal" value={allowedText} onChange={(event) => setAllowedText(event.target.value)} placeholder="0" />
          </Field>
        </div>
        <InlineError message={budgetError} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save hours allowed</Button>
          {editingBudget ? (
            <Button type="button" variant="outline" onClick={clearBudget}>
              Cancel
            </Button>
          ) : null}
        </div>
        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hours allowed yet.</p>
        ) : (
          <ul className="grid gap-2">
            {budgets.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                <span className="text-base font-semibold">
                  {row.label}: {formatHours(row.allowedHours)} hours
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBudget(row);
                      setAllowedText(String(row.allowedHours));
                      setEditingBudget(true);
                      setBudgetError(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      void deleteLaborBudget(row.id).then(() => {
                        if (budget.id === row.id) clearBudget();
                        toast.success("Hours allowed removed");
                      });
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <form onSubmit={onEntry} className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 className="font-display text-2xl font-bold">{editingEntry ? "Edit hours" : "Add hours"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <TextField type="date" value={entry.date} onChange={(event) => setEntry((current) => ({ ...current, date: event.target.value }))} />
          </Field>
          <Field label="Hours">
            <TextField inputMode="decimal" value={hoursText} onChange={(event) => setHoursText(event.target.value)} placeholder="8" />
          </Field>
        </div>
        <Field label="Worker" hint="Optional.">
          <TextField value={entry.workerName} onChange={(event) => setEntry((current) => ({ ...current, workerName: event.target.value }))} />
        </Field>
        <Field label="Note" hint="Optional.">
          <AreaField value={entry.note} onChange={(event) => setEntry((current) => ({ ...current, note: event.target.value }))} />
        </Field>
        <InlineError message={entryError} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editingEntry ? "Save hours" : "Add hours"}</Button>
          {editingEntry ? (
            <Button type="button" variant="outline" onClick={clearEntry}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState title="No hours typed yet" body="Add hours above. Daily report manpower still counts on days you leave blank." />
      ) : (
        <ul className="grid gap-3">
          {entries.map((row) => (
            <li key={row.id} className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
              <div className="grid gap-1">
                <span className="font-display text-2xl font-bold">
                  {formatHours(row.hours)} hours · {formatDay(row.date, today)}
                </span>
                <span className="text-sm text-muted-foreground">{row.workerName || "No worker name"}</span>
                {row.note ? <span className="text-sm">{row.note}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEntry(row);
                    setHoursText(String(row.hours));
                    setEditingEntry(true);
                    setEntryError(null);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    void deleteTimeEntry(row.id).then(() => {
                      if (entry.id === row.id) clearEntry();
                      toast.success("Hours removed");
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-background px-3 py-3 ring-1 ring-border">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={warn ? "font-display text-2xl font-bold text-orange" : "font-display text-2xl font-bold"}>{value}</dd>
    </div>
  );
}
