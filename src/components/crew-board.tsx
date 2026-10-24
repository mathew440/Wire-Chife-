"use client";

import { ConfirmDialog, DateFlag, Field, PageIntro, SampleBadge, SelectField, TextField, ConfirmationToggle } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { blankAssignment, blankPerson } from "@/lib/data/factories";
import { deleteAssignment, deletePerson, getSettings, listAssignments, listPeople, listProjects, saveAssignment, savePerson, saveSettings } from "@/lib/data/repo";
import { foremanDisplay, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import { addDays, formatDay, todayISO } from "@/lib/domain/dates";
import type { Confirmation } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { toast } from "sonner";

export function CrewBoard() {
  const { status, error } = useDbReady();
  const [day, setDay] = useState(todayISO());
  const [filter, setFilter] = useState("all");
  const people = useLiveQuery(() => (status === "ready" ? listPeople() : undefined), [status]);
  const projects = useLiveQuery(() => (status === "ready" ? listProjects() : undefined), [status]);
  const assignments = useLiveQuery(() => (status === "ready" ? listAssignments({ date: day }) : undefined), [status, day]);
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const [personId, setPersonId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [area, setArea] = useState("");
  const [hours, setHours] = useState("8");
  const [confirmation, setConfirmation] = useState<Confirmation>("confirmed");
  const [name, setName] = useState("");
  const [classification, setClassification] = useState("Journeyman");
  const [foremanDraft, setForemanDraft] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !people || !projects || !assignments || !settings) return <PageFallback />;

  const foremanName = foremanDraft ?? settings.foremanName;

  const visible = assignments.filter((assignment) => filter === "all" || assignment.projectId === filter);
  const bench = people.filter((person) => !assignments.some((assignment) => assignment.personId === person.id));

  async function addAssignment() {
    setFormError(null);
    try {
      const parsed = hours.trim() === "" ? null : Number(hours);
      await saveAssignment(
        blankAssignment({
          personId,
          projectId,
          date: day,
          area,
          hours: parsed != null && Number.isFinite(parsed) ? parsed : null,
          confirmation,
        }),
      );
      setArea("");
      toast.success("Assignment saved on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not assign");
    }
  }

  async function addPerson() {
    if (!name.trim()) {
      setFormError("A person needs a name.");
      return;
    }
    setFormError(null);
    await savePerson(blankPerson({ name, classification, phone }));
    setName("");
    setPhone("");
    toast.success("Added to the roster on this device");
  }

  return (
    <div className="grid gap-5">
      <PageIntro
        eyebrow="Roster"
        title="Crew"
        description={`Who is on which job and area for the day. ${settings.profileName} is ${settings.profileRole || SEEDED_PROFILE_ROLE}. Foreman: ${foremanDisplay(settings.foremanName)}. Assignments stay on the job you pick.`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setDay(addDays(day, -1))}>
          Previous day
        </Button>
        <div className="min-w-40 text-center">
          <p className="font-display text-3xl font-bold">{formatDay(day)}</p>
          <p className="text-sm text-muted-foreground">{day}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setDay(addDays(day, 1))}>
          Next day
        </Button>
        <Button type="button" variant="secondary" onClick={() => setDay(todayISO())}>
          Today
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        <Button type="button" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All jobs
        </Button>
        {projects.map((project) => (
          <Button key={project.id} type="button" variant={filter === project.id ? "default" : "outline"} onClick={() => setFilter(project.id)}>
            {project.name}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">On the job</h2>
            {visible.length === 0 ? <p className="text-muted-foreground">Nobody is assigned for this date.</p> : null}
            <ul className="grid gap-2">
              {visible.map((assignment) => {
                const person = people.find((item) => item.id === assignment.personId);
                const project = projects.find((item) => item.id === assignment.projectId);
                return (
                  <li key={assignment.id} className="grid gap-2 rounded-lg bg-background px-3 py-3 ring-1 ring-border sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-semibold">{person?.name ?? "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {project?.name} · {assignment.area || "No area"} · {assignment.hours ?? "—"}h
                      </p>
                      <DateFlag value={assignment.confirmation} />
                    </div>
                    <Button type="button" variant="outline" onClick={() => void deleteAssignment(assignment.id)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
            <h3 className="font-display text-xl font-bold">Assign someone</h3>
            <Field label="Person">
              <SelectField value={personId} onChange={(event) => setPersonId(event.target.value)}>
                <option value="">Choose</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.classification}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Job">
              <SelectField value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Choose</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </SelectField>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Area">
                <TextField value={area} onChange={(event) => setArea(event.target.value)} placeholder="Wing B, Row C" />
              </Field>
              <Field label="Hours">
                <TextField inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
              </Field>
            </div>
            <ConfirmationToggle value={confirmation} onChange={setConfirmation} />
            <InlineError message={formError} />
            <Button type="button" onClick={() => void addAssignment()}>
              Assign
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Roster</h2>
            <Field label="Foreman" hint="Separate from the project manager. Leave blank until the name is verified.">
              <TextField value={foremanName} placeholder="Needs verification" onChange={(event) => setForemanDraft(event.target.value)} />
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void saveSettings({ ...settings, foremanName: foremanName.trim() }).then(() => {
                  setForemanDraft(null);
                  toast.success("Foreman saved on this device");
                });
              }}
            >
              Save foreman
            </Button>
            <p className="text-sm text-muted-foreground">
              Not assigned {formatDay(day)}: {bench.length === 0 ? "everyone is on a job" : bench.map((person) => person.name).join(", ")}
            </p>
            <ul className="grid gap-2">
              {people.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-3 ring-1 ring-border">
                  <div>
                    <p className="font-semibold">
                      {person.name} {person.isSample ? <SampleBadge /> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{person.classification}</p>
                    {person.phone ? (
                      <a className="text-sm font-semibold text-teal" href={`tel:${person.phone}`}>
                        {person.phone}
                      </a>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setRemoveId(person.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <h3 className="font-display text-xl font-bold">Add a person</h3>
            <Field label="Name">
              <TextField value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Classification">
                <SelectField value={classification} onChange={(event) => setClassification(event.target.value)}>
                  <option>Project Manager</option>
                  <option>Foreman</option>
                  <option>Journeyman</option>
                  <option>Apprentice</option>
                </SelectField>
              </Field>
              <Field label="Phone">
                <TextField type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
            </div>
            <Button type="button" onClick={() => void addPerson()}>
              Add to roster
            </Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={removeId != null}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="Remove this person?"
        body="Their assignments come off the board. Jobs and reports stay."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removeId) return;
          void deletePerson(removeId).then(() => {
            toast.success("Removed from the roster");
            setRemoveId(null);
          });
        }}
      />
    </div>
  );
}
