"use client";

import { DateFlag, PageIntro, ProjectStatusPill, SampleBadge } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listAllEstimates, listAllReports, listAllSchedule, listAssignments, listPeople, listProjects, listTasks } from "@/lib/data/repo";
import { projectPulse } from "@/lib/domain/dashboard";
import { duePhrase, formatDay, todayISO } from "@/lib/domain/dates";
import { weatherLabel } from "@/lib/domain/reports";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";

export function JobsHome() {
  const { status, error } = useDbReady();
  const today = todayISO();
  const projects = useLiveQuery(() => listProjects(), []);
  const tasks = useLiveQuery(() => listTasks(), []);
  const reports = useLiveQuery(() => listAllReports(), []);
  const schedule = useLiveQuery(() => listAllSchedule(), []);
  const estimates = useLiveQuery(() => listAllEstimates(), []);
  const assignments = useLiveQuery(() => listAssignments({ date: today }), [today]);
  const people = useLiveQuery(() => listPeople(), []);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !projects || !tasks || !reports || !schedule || !estimates || !assignments || !people) {
    return <PageFallback />;
  }

  const hasSample = projects.some((project) => project.isSample);
  const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today);

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="AKA Electric"
        title="Jobs"
        description="Each job keeps its own reports, crew, open items, estimates, and files. Nothing here leaves this device."
        actions={
          <Button nativeButton={false} render={<Link href="/projects/new" />}>New job</Button>
        }
      />

      {hasSample ? (
        <p className="rounded-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm text-foreground">
          Some jobs on this device came from an earlier starter book. They stay separate from jobs you create. Remove them on the Data page when this book should only hold live work.
        </p>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No jobs on this device"
          body="Add the first job with a name, job number, GC, and the people you call."
          action={<Button nativeButton={false} render={<Link href="/projects/new" />}>New job</Button>}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => {
            const pulse = projectPulse({
              today,
              tasks: tasks.filter((task) => task.projectId === project.id),
              reports: reports.filter((report) => report.projectId === project.id),
              schedule: schedule.filter((item) => item.projectId === project.id),
              estimates: estimates.filter((estimate) => estimate.projectId === project.id),
            });
            const weather = pulse.latest ? weatherLabel(pulse.latest) : null;
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-xl focus-visible:outline-none">
                <Card className="h-full bg-card text-base transition-colors hover:bg-secondary/40">
                  <CardContent className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {project.isSample ? <SampleBadge /> : null}
                      <ProjectStatusPill status={project.status} />
                    </div>
                    <div>
                      <h2 className="font-display text-3xl leading-none font-bold">{project.name}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {project.jobNumber ? `Job ${project.jobNumber}` : "No job number"} · {project.gc || "No GC"}
                      </p>
                      <p className="text-sm text-muted-foreground">{project.location}</p>
                      <p className="mt-2 text-sm">{project.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Stat label="Open items" value={String(pulse.openCount)} />
                      <Stat label="Overdue" value={String(pulse.overdueCount)} warn={pulse.overdueCount > 0} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pulse.latest ? (
                        <>
                          Last report {formatDay(pulse.latest.date, today)} <DateFlag value={pulse.latest.dateConfirmation} />{" "}
                          {weather?.entered ? "Weather entered" : "Weather unverified"}
                        </>
                      ) : (
                        "No daily report yet"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pulse.next ? (
                        <>
                          Next: {pulse.next.label} · {formatDay(pulse.next.date, today)} <DateFlag value={pulse.next.confirmation} />
                        </>
                      ) : (
                        "No upcoming date"
                      )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Overdue on this device</h2>
            {overdue.length === 0 ? (
              <p className="text-muted-foreground">No open item is past its due date.</p>
            ) : (
              <ul className="grid gap-2">
                {overdue.map((task) => {
                  const project = projects.find((item) => item.id === task.projectId);
                  return (
                    <li key={task.id}>
                      <Link href={`/projects/${task.projectId}/tasks/${task.id}`} className="grid gap-1 rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                        <span className="font-semibold">{task.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {project?.name ?? "Unknown job"} · {task.dueDate ? duePhrase(task.dueDate, today) : ""} · <DateFlag value={task.dueConfirmation} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Crew today</h2>
              <Button variant="outline" nativeButton={false} render={<Link href="/crew" />}>
                Crew board
              </Button>
            </div>
            {assignments.length === 0 ? (
              <p className="text-muted-foreground">Nobody is assigned for {formatDay(today)}.</p>
            ) : (
              <ul className="grid gap-2">
                {assignments.map((assignment) => {
                  const person = people.find((item) => item.id === assignment.personId);
                  const project = projects.find((item) => item.id === assignment.projectId);
                  return (
                    <li key={assignment.id} className="rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                      <p className="font-semibold">{person?.name ?? "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {project?.name ?? "Unknown job"} · {assignment.area || "No area"} · {assignment.hours ?? "—"}h ·{" "}
                        <DateFlag value={assignment.confirmation} />
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={warn ? "font-display text-2xl font-bold text-orange" : "font-display text-2xl font-bold"}>{value}</p>
    </div>
  );
}
