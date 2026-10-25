"use client";

import { DateFlag, PageIntro, ProjectStatusPill, SampleBadge, TextField, SelectField, Field, ConfirmationToggle } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { blankSchedule } from "@/lib/data/factories";
import {
  getSettings,
  listAssignments,
  listAttachments,
  listEstimates,
  listLaborBudgets,
  listLogItems,
  listOrders,
  listPeople,
  listReports,
  listSchedule,
  listTasks,
  listTimeEntries,
  saveSchedule,
} from "@/lib/data/repo";
import { getProject } from "@/lib/data/repo";
import { preparedByLabel } from "@/lib/data/roles";
import { isOverdueTask, projectPulse } from "@/lib/domain/dashboard";
import { addDays, duePhrase, formatDay, todayISO } from "@/lib/domain/dates";
import { summarizeHours } from "@/lib/domain/hours";
import { isClosedLog } from "@/lib/domain/logs";
import { isLateOrder } from "@/lib/domain/orders";
import { weatherLabel } from "@/lib/domain/reports";
import { downloadBytes } from "@/lib/pdf/download";
import { buildWeeklySummaryPdf, weeklyPdfFileName } from "@/lib/pdf/weekly-summary-pdf";
import type { Confirmation, ScheduleKind } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { use, useState } from "react";
import { toast } from "sonner";

export function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => {
    if (status !== "ready") return undefined;
    return (await getProject(id)) ?? null;
  }, [id, status]);
  const tasks = useLiveQuery(() => listTasks(id), [id]);
  const reports = useLiveQuery(() => listReports(id), [id]);
  const schedule = useLiveQuery(() => listSchedule(id), [id]);
  const estimates = useLiveQuery(() => listEstimates(id), [id]);
  const assignments = useLiveQuery(() => listAssignments({ projectId: id, date: today }), [id, today]);
  const people = useLiveQuery(() => listPeople(), []);
  const files = useLiveQuery(() => listAttachments(id), [id]);
  const logItems = useLiveQuery(() => listLogItems(id), [id]);
  const orders = useLiveQuery(() => listOrders(id), [id]);
  const laborBudgets = useLiveQuery(() => listLaborBudgets(id), [id]);
  const timeEntries = useLiveQuery(() => listTimeEntries(id), [id]);
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (
    status !== "ready" ||
    project === undefined ||
    !tasks ||
    !reports ||
    !schedule ||
    !estimates ||
    !assignments ||
    !people ||
    !files ||
    !logItems ||
    !orders ||
    !laborBudgets ||
    !timeEntries ||
    !settings
  ) {
    return <PageFallback />;
  }
  if (project === null) {
    return (
      <EmptyState
        title="This job is not on this device"
        body="It may have been removed, or this link is from another phone."
        action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>}
      />
    );
  }

  const pulse = projectPulse({ today, tasks, reports, schedule, estimates });
  const weather = pulse.latest ? weatherLabel(pulse.latest) : null;

  async function exportWeek() {
    const weekStart = addDays(today, -6);
    const hours = summarizeHours({ budgets: laborBudgets!, entries: timeEntries!, reports: reports! });
    const bytes = await buildWeeklySummaryPdf({
      company: settings!.companyName,
      preparedBy: preparedByLabel(settings!.profileName, settings!.profileRole),
      email: settings!.profileEmail,
      foremanName: settings!.foremanName,
      projectName: project!.name,
      jobNumber: project!.jobNumber,
      isSample: project!.isSample,
      weekEnding: today,
      weekStart,
      reports: reports!
        .filter((report) => report.date >= weekStart && report.date <= today)
        .map((report) => ({
          date: report.date,
          dateConfirmation: report.dateConfirmation,
          weatherText: report.weatherText,
          weatherEntered: report.weatherEntered,
          completed: report.completed,
          ongoing: report.ongoing,
          planned: report.planned,
          needsVerification: report.needsVerification,
          blockers: report.blockers,
        })),
      openItems: tasks!.filter((task) => task.status !== "done"),
      openLogs: logItems!.filter((item) => !isClosedLog(item.status)),
      orders: orders!.map((order) => ({
        description: order.description,
        vendor: order.vendor,
        quantity: order.quantity,
        status: order.status,
        expectedDate: order.expectedDate,
        late: isLateOrder(order, today),
      })),
      hours: {
        allowed: hours.allowed,
        used: hours.used,
        remaining: hours.remaining,
        percent: hours.percent,
        burnPerWeek: hours.burnPerWeek,
        fromTimeEntries: hours.fromTimeEntries,
        fromReports: hours.fromReports,
      },
    });
    downloadBytes(bytes, weeklyPdfFileName(project!.name, today));
    toast.success("Weekly PDF downloaded");
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="dashboard" />
      <PageIntro
        eyebrow={project.jobNumber ? `Job ${project.jobNumber}` : "Job"}
        title={project.name}
        description={`${project.description} ${project.gc ? `GC: ${project.gc}.` : ""} ${project.location}`}
        actions={
          <>
            <Button nativeButton={false} render={<Link href={`/projects/${id}/reports/new`} />}>New report</Button>
            <Button type="button" variant="outline" onClick={() => void exportWeek()}>
              Weekly PDF
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/edit`} />}>
              Edit job
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {project.isSample ? <SampleBadge /> : null}
        <ProjectStatusPill status={project.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open items" value={String(pulse.openCount)} href={`/projects/${id}/tasks`} />
        <Metric label="Overdue" value={String(pulse.overdueCount)} href={`/projects/${id}/tasks`} warn={pulse.overdueCount > 0} />
        <Metric
          label="Latest report"
          value={pulse.latest ? formatDay(pulse.latest.date, today) : "None"}
          href={pulse.latest ? `/projects/${id}/reports/${pulse.latest.id}` : `/projects/${id}/reports/new`}
        />
        <Metric
          label="Next date"
          value={pulse.next ? formatDay(pulse.next.date, today) : "None"}
          href={`/projects/${id}/lookahead`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="bg-card text-base xl:col-span-3">
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold">Latest report</h2>
              <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/reports`} />}>
                All reports
              </Button>
            </div>
            {pulse.latest && weather ? (
              <div className="grid gap-2">
                <p className="flex flex-wrap items-center gap-2">
                  {formatDay(pulse.latest.date, today)} <DateFlag value={pulse.latest.dateConfirmation} />
                  <span className={weather.entered ? "text-teal" : "font-bold text-orange"}>{weather.entered ? "Weather entered" : "Weather unverified"}</span>
                </p>
                <p>{pulse.latest.completed || "No completed work written down."}</p>
                <Button nativeButton={false} render={<Link href={`/projects/${id}/reports/${pulse.latest.id}`} />}>Open report</Button>
              </div>
            ) : (
              <EmptyState
                title="No daily report yet"
                body="Write today's work, or paste dictated notes and send them into a section yourself."
                action={<Button nativeButton={false} render={<Link href={`/projects/${id}/reports/new`} />}>New report</Button>}
              />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card text-base xl:col-span-2">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Upcoming dates</h2>
            <ScheduleForm projectId={id} />
            {pulse.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dates yet. Every date stays tentative until you mark it confirmed.</p>
            ) : (
              <ul className="grid gap-2">
                {pulse.upcoming.map((entry) => (
                  <li key={`${entry.kind}-${entry.id}`}>
                    <Link href={entry.href} className="grid gap-1 rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                      <span className="font-semibold">{entry.label}</span>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {formatDay(entry.date, today)} · {duePhrase(entry.date, today)} · {entry.kind}
                        <DateFlag value={entry.confirmation} />
                        {entry.overdue ? <span className="font-bold text-orange">OVERDUE</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="bg-card text-base xl:col-span-3">
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold">Open items</h2>
              <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/tasks/new`} />}>
                New item
              </Button>
            </div>
            {pulse.openTasks.length === 0 ? (
              <p className="text-muted-foreground">Nothing open on this job.</p>
            ) : (
              <ul className="grid gap-2">
                {pulse.openTasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/projects/${id}/tasks/${task.id}`} className="grid gap-1 rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                      <span className="font-semibold">{task.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {task.owner || "No owner"}
                        {task.dueDate ? ` · ${duePhrase(task.dueDate, today)}` : " · No due date"}
                        {task.dueDate ? <> · <DateFlag value={task.dueConfirmation} /></> : null}
                        {task.dueDate && isOverdueTask(task, today) ? <span className="font-bold text-orange"> OVERDUE</span> : null}
                      </span>
                      <span className="text-sm">{task.evidence ? `Source: ${task.evidence}` : "No source yet"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:col-span-2">
          <Card className="bg-card text-base">
            <CardContent className="grid gap-2">
              <h2 className="font-display text-2xl font-bold">On this job today</h2>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is assigned here today.</p>
              ) : (
                assignments.map((assignment) => {
                  const person = people.find((item) => item.id === assignment.personId);
                  return (
                    <p key={assignment.id} className="text-sm">
                      {person?.name ?? "Unknown"} · {assignment.area || "No area"} · {assignment.hours ?? "—"}h ·{" "}
                      <DateFlag value={assignment.confirmation} />
                    </p>
                  );
                })
              )}
              <Button variant="outline" nativeButton={false} render={<Link href="/crew" />}>
                Crew board
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-card text-base">
            <CardContent className="grid gap-2">
              <h2 className="font-display text-2xl font-bold">Contacts</h2>
              {project.contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts yet.</p> : null}
              {project.contacts.map((contact) => (
                <div key={contact.id}>
                  <p className="font-semibold">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{[contact.company, contact.role].filter(Boolean).join(" · ")}</p>
                  {contact.phone ? (
                    <a className="block text-sm font-semibold text-teal" href={`tel:${contact.phone}`}>
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a className="block text-sm font-semibold text-teal" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  ) : null}
                </div>
              ))}
              <Button variant="outline" nativeButton={false} render={<Link href="/contacts" />}>
                All contacts
              </Button>
              <p className="text-sm text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"} on this job.</p>
              <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/files`} />}>
                Files
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, href, warn = false }: { label: string; value: string; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="rounded-xl bg-card px-4 py-3 ring-1 ring-border">
      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={warn ? "font-display text-3xl font-bold text-orange" : "font-display text-3xl font-bold"}>{value}</p>
    </Link>
  );
}

function ScheduleForm({ projectId }: { projectId: string }) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayISO());
  const [confirmation, setConfirmation] = useState<Confirmation>("tentative");
  const [kind, setKind] = useState<ScheduleKind>("inspection");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await saveSchedule(blankSchedule(projectId, { label, date, confirmation, kind }));
      setLabel("");
      toast.success("Date saved on this device");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the date");
    }
  }

  return (
    <div className="grid gap-2 rounded-lg bg-background p-3 ring-1 ring-border">
      <Field label="Add a date">
        <TextField value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Rough inspection, delivery, meeting" />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Day">
          <TextField type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Kind">
          <SelectField value={kind} onChange={(event) => setKind(event.target.value as ScheduleKind)}>
            <option value="inspection">Inspection</option>
            <option value="delivery">Delivery</option>
            <option value="meeting">Meeting</option>
            <option value="milestone">Milestone</option>
            <option value="other">Other</option>
          </SelectField>
        </Field>
      </div>
      <ConfirmationToggle value={confirmation} onChange={setConfirmation} />
      <InlineError message={error} />
      <Button type="button" onClick={add}>
        Add date
      </Button>
    </div>
  );
}
