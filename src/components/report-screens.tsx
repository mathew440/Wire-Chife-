"use client";

import { AreaField, ConfirmDialog, DateFlag, Field, PageIntro, SampleBadge, TextField, ConfirmationToggle } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { PdfCanvas } from "@/components/pdf-view";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankAttachment, blankReport } from "@/lib/data/factories";
import { newId } from "@/lib/data/id";
import {
  deleteReport,
  getProject,
  getReport,
  getSettings,
  listAssignments,
  listAttachments,
  listPeople,
  listReports,
  saveAttachment,
  saveReport,
} from "@/lib/data/repo";
import { formatDay, todayISO } from "@/lib/domain/dates";
import { REPORT_NOTES, REPORT_SECTIONS, appendToReportSection, weatherLabel } from "@/lib/domain/reports";
import { prepareUpload } from "@/lib/files/prepare";
import { buildDailyReportPdf, reportPdfFileName } from "@/lib/pdf/daily-report-pdf";
import { downloadBytes } from "@/lib/pdf/download";
import type { DailyReport, ReportSectionKey } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

export function ReportList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const reports = useLiveQuery(() => listReports(id), [id]);
  const today = todayISO();

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !reports) return <PageFallback />;
  if (project === null) return <MissingJob />;

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="reports" />
      <PageIntro
        eyebrow={project.name}
        title="Daily reports"
        description="Completed, ongoing, planned, and needs verification stay separate. A blank weather line stays unverified."
        actions={<Button nativeButton={false} render={<Link href={`/projects/${id}/reports/new`} />}>New report</Button>}
      />
      {reports.length === 0 ? (
        <EmptyState title="No reports on this job" body="The first report can be today's work, or a paste of dictated notes." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/reports/new`} />}>New report</Button>} />
      ) : (
        <ul className="grid gap-3">
          {reports.map((report) => {
            const weather = weatherLabel(report);
            return (
              <li key={report.id}>
                <Link href={`/projects/${id}/reports/${report.id}`} className="grid gap-2 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-2xl font-bold">{formatDay(report.date, today)}</span>
                    <DateFlag value={report.dateConfirmation} />
                    {report.isSample ? <SampleBadge /> : null}
                    <span className={weather.entered ? "text-sm font-bold text-teal" : "text-sm font-bold text-orange"}>
                      {weather.entered ? "Weather entered" : "Weather unverified"}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{report.manpower.length} on the report · {report.completed || "No completed work written down."}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ReportEditor({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = use(params);
  const isNew = reportId === "new";
  const router = useRouter();
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const existing = useLiveQuery(async () => {
    if (isNew || status !== "ready") return undefined;
    return (await getReport(reportId)) ?? null;
  }, [isNew, reportId, status]);
  const people = useLiveQuery(() => listPeople(), []);
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const files = useLiveQuery(() => listAttachments(id), [id]);
  const [created] = useState<DailyReport | null>(() => (isNew ? blankReport(id) : null));
  const [edits, setEdits] = useState<DailyReport | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dictationRef = useRef<HTMLTextAreaElement>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !people || !files) return <PageFallback />;
  if (project === null) return <MissingJob />;
  if (!isNew) {
    if (existing === undefined) return <PageFallback />;
    if (existing === null || existing.projectId !== id) {
      return <EmptyState title="This report is not on this job" body="Reports stay on the job they were written for." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/reports`} />}>Back to reports</Button>} />;
    }
  }
  const source = (isNew ? created : existing) as DailyReport;
  const draft = edits ?? source;

  const weather = weatherLabel({ weatherText: draft.weatherText, weatherEntered: draft.weatherText.trim().length > 0 });
  const linked = files.filter((file) => file.parentType === "report" && file.parentId === draft.id);

  function update(partial: Partial<DailyReport>) {
    setEdits((current) => ({ ...(current ?? source), ...partial }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.date) {
      setFormError("A report needs a date.");
      return;
    }
    setFormError(null);
    try {
      const saved = await saveReport(draft);
      toast.success("Report saved on this device");
      if (isNew) router.replace(`/projects/${id}/reports/${saved.id}`);
      else setEdits(saved);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  function sendTo(key: ReportSectionKey) {
    const el = dictationRef.current;
    if (!el) return;
    const selected = el.selectionEnd > el.selectionStart ? el.value.slice(el.selectionStart, el.selectionEnd) : el.value;
    if (!selected.trim()) {
      toast.message("Paste or select notes before sending them.");
      return;
    }
    setEdits((current) => appendToReportSection(current ?? source, key, selected));
    const label = REPORT_SECTIONS.find((section) => section.key === key)?.label ?? "section";
    toast.success(`Sent to ${label}. Dictation stays in the box.`);
  }

  async function pullCrew() {
    if (!draft || !people) return;
    const assigned = await listAssignments({ projectId: id, date: draft.date });
    if (assigned.length === 0) {
      toast.message("Nobody is assigned to this job on that date.");
      return;
    }
    setEdits((current) => {
      const base = current ?? source;
      const have = new Set(base.manpower.map((row) => row.personId).filter(Boolean));
      const added = assigned
        .filter((row) => !have.has(row.personId))
        .map((row) => ({
          id: newId(),
          personId: row.personId,
          name: people.find((person) => person.id === row.personId)?.name ?? "Unknown",
          hours: row.hours,
          area: row.area,
        }));
      return { ...base, manpower: [...base.manpower, ...added] };
    });
  }

  async function exportPdf(mode: "download" | "preview") {
    if (!settings || !draft || !project) return;
    const bytes = await buildDailyReportPdf({
      company: settings.companyName,
      preparedBy: settings.profileName,
      projectName: project.name,
      jobNumber: project.jobNumber,
      gc: project.gc,
      location: project.location,
      isSample: project.isSample,
      date: draft.date,
      dateConfirmation: draft.dateConfirmation,
      weatherText: draft.weatherText,
      weatherEntered: draft.weatherText.trim().length > 0,
      manpower: draft.manpower,
      completed: draft.completed,
      ongoing: draft.ongoing,
      planned: draft.planned,
      needsVerification: draft.needsVerification,
      punchItems: draft.punchItems,
      inspections: draft.inspections,
      materials: draft.materials,
      blockers: draft.blockers,
      decisions: draft.decisions,
      tomorrowOutlook: draft.tomorrowOutlook,
      dictatedNotes: draft.dictatedNotes,
    });
    const name = reportPdfFileName(project.name, draft.date);
    if (mode === "download") {
      downloadBytes(bytes, name);
      toast.success("PDF downloaded");
    } else {
      setPreview({ bytes, name });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || isNew || !draft) return;
    try {
      const prepared = await prepareUpload(file);
      await saveAttachment(
        blankAttachment(id, {
          parentType: "report",
          parentId: draft.id,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          blob: prepared.blob,
        }),
      );
      toast.success("File saved on this report");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not attach the file");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <ProjectTabs projectId={id} current="reports" />
      <PageIntro
        eyebrow={project.name}
        title={isNew ? "New daily report" : formatDay(draft.date)}
        description="Fast on a phone. Paste dictated notes, then send the words into a section yourself. Wire Chief will not move them."
        actions={
          <>
            {project.isSample ? <SampleBadge /> : null}
            <DateFlag value={draft.dateConfirmation} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr_16rem]">
        <Field label="Report date" hint="The day the work happened.">
          <TextField type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} required />
        </Field>
        <Field label="Date status" hint="Tentative if you are drafting ahead. Confirmed once the day is real.">
          <ConfirmationToggle value={draft.dateConfirmation} onChange={(dateConfirmation) => update({ dateConfirmation })} />
        </Field>
        <Field label="Weather" hint="Leave this blank to keep the day unverified. Wire Chief does not look weather up.">
          <TextField value={draft.weatherText} onChange={(event) => update({ weatherText: event.target.value })} placeholder="Clear, 52 F" />
        </Field>
      </div>
      <p className={weather.entered ? "text-sm font-bold text-teal" : "text-sm font-bold text-orange"}>{weather.text}</p>

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Manpower</h2>
          <Button type="button" variant="outline" onClick={() => void pullCrew()}>
            Use the crew for this date
          </Button>
        </div>
        {draft.manpower.map((row, index) => (
          <div key={row.id} className="grid gap-2 lg:grid-cols-[1.4fr_1fr_8rem_auto]">
            <TextField
              value={row.name}
              list="crew-names"
              aria-label={`Name ${index + 1}`}
              onChange={(event) => {
                const manpower = draft.manpower.slice();
                const match = people.find((person) => person.name === event.target.value);
                manpower[index] = { ...row, name: event.target.value, personId: match?.id ?? row.personId };
                update({ manpower });
              }}
            />
            <TextField
              value={row.area}
              aria-label={`Area ${index + 1}`}
              placeholder="Area"
              onChange={(event) => {
                const manpower = draft.manpower.slice();
                manpower[index] = { ...row, area: event.target.value };
                update({ manpower });
              }}
            />
            <TextField
              inputMode="decimal"
              aria-label={`Hours ${index + 1}`}
              value={row.hours ?? ""}
              placeholder="Hours"
              onChange={(event) => {
                const manpower = draft.manpower.slice();
                const hours = event.target.value === "" ? null : Number(event.target.value);
                manpower[index] = { ...row, hours: hours != null && Number.isFinite(hours) ? hours : null };
                update({ manpower });
              }}
            />
            <Button type="button" variant="outline" onClick={() => update({ manpower: draft.manpower.filter((item) => item.id !== row.id) })}>
              Remove
            </Button>
          </div>
        ))}
        <datalist id="crew-names">
          {people.map((person) => (
            <option key={person.id} value={person.name} />
          ))}
        </datalist>
        <Button
          type="button"
          variant="secondary"
          onClick={() => update({ manpower: [...draft.manpower, { id: newId(), personId: null, name: "", hours: 8, area: "" }] })}
        >
          Add a name
        </Button>
      </section>

      <section className="grid gap-3 rounded-xl border border-teal/40 bg-card p-4">
        <h2 className="font-display text-2xl font-bold">Dictated notes</h2>
        <p className="text-sm text-muted-foreground">
          Paste the whole note. Select a piece if you only want that piece. Nothing is filed until you hit a send button. The four statuses never change on their own.
        </p>
        <AreaField ref={dictationRef} value={draft.dictatedNotes} onChange={(event) => update({ dictatedNotes: event.target.value })} className="min-h-48" placeholder="Paste dictated notes here." />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_SECTIONS.map((section) => (
            <Button key={section.key} type="button" variant="outline" onClick={() => sendTo(section.key)}>
              Send to {section.label}
            </Button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {REPORT_SECTIONS.map((section) => (
          <Field key={section.key} label={section.label} hint={section.hint}>
            <AreaField
              value={draft[section.key]}
              onChange={(event) => update({ [section.key]: event.target.value })}
              className={cn("min-h-36 border-l-4", sectionBorder(section.key))}
            />
          </Field>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Completed, ongoing, planned, and needs verification stay as you wrote them.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        {REPORT_NOTES.map((note) => (
          <Field key={note.key} label={note.label}>
            <AreaField value={draft[note.key]} onChange={(event) => update({ [note.key]: event.target.value })} className="min-h-28" />
          </Field>
        ))}
      </div>

      <section className="grid gap-2">
        <h2 className="font-display text-2xl font-bold">Photos and drawings on this report</h2>
        {isNew ? <p className="text-sm text-muted-foreground">Save the report first, then attach a photo or PDF.</p> : null}
        {!isNew ? (
          <label className="grid gap-2">
            <span className="text-sm font-bold">Attach a photo or PDF</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block h-12 w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-teal file:px-4 file:font-bold file:text-teal-ink"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void onFile(file);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
        <ul className="grid gap-2">
          {linked.map((file) => (
            <li key={file.id}>
              <Link className="font-semibold text-teal" href={`/projects/${id}/files/${file.id}`}>
                {file.fileName}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <InlineError message={formError} />
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap gap-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur md:bottom-4">
        <Button type="submit">Save report</Button>
        <Button type="button" variant="secondary" onClick={() => void exportPdf("preview")}>
          Preview PDF
        </Button>
        <Button type="button" variant="outline" onClick={() => void exportPdf("download")}>
          Download PDF
        </Button>
        {!isNew ? (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>

      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Daily report PDF</DialogTitle>
          </DialogHeader>
          {preview ? <PdfCanvas data={preview.bytes} /> : null}
          {preview ? (
            <Button type="button" onClick={() => downloadBytes(preview.bytes, preview.name)}>
              Download PDF
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this report?"
        body="It comes off this job. Other jobs are not touched."
        confirmLabel="Delete report"
        onConfirm={() => {
          void deleteReport(draft.id).then(() => {
            toast.success("Report removed");
            router.push(`/projects/${id}/reports`);
          });
        }}
      />
    </form>
  );
}

function sectionBorder(key: ReportSectionKey): string {
  if (key === "completed") return "border-l-teal";
  if (key === "ongoing") return "border-l-info";
  if (key === "planned") return "border-l-orange";
  return "border-l-warn";
}

function MissingJob() {
  return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
}
