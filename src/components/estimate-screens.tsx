"use client";

import { AreaField, ConfirmDialog, DateFlag, Field, PageIntro, SampleBadge, SelectField, TextField, ConfirmationToggle } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { PdfCanvas } from "@/components/pdf-view";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankEstimate, blankMaterialLine } from "@/lib/data/factories";
import { deleteEstimate, getEstimate, getProject, getSettings, listEstimates, saveEstimate } from "@/lib/data/repo";
import { crewTime, materialSummary } from "@/lib/domain/estimates";
import { formatDay } from "@/lib/domain/dates";
import { downloadBytes } from "@/lib/pdf/download";
import { buildEstimatePdf, estimatePdfFileName } from "@/lib/pdf/estimate-pdf";
import type { DurationUnit, Estimate } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

export function EstimateList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const estimates = useLiveQuery(() => listEstimates(id), [id]);
  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !estimates) return <PageFallback />;
  if (project === null) return <Missing />;
  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="estimates" />
      <PageIntro
        eyebrow={project.name}
        title="Estimates"
        description="Short scope, material list, and labor as crew size times duration. No prices."
        actions={<Button nativeButton={false} render={<Link href={`/projects/${id}/estimates/new`} />}>New estimate</Button>}
      />
      {estimates.length === 0 ? (
        <EmptyState title="No estimates on this job" body="A takeoff here is quantities and crew time. It is not a daily report and it is not a quote." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/estimates/new`} />}>New estimate</Button>} />
      ) : (
        <ul className="grid gap-3">
          {estimates.map((estimate) => (
            <li key={estimate.id}>
              <Link href={`/projects/${id}/estimates/${estimate.id}`} className="grid gap-1 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-2xl font-bold">{estimate.title}</span>
                  {estimate.isSample ? <SampleBadge /> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {materialSummary(estimate.materials)} · {crewTime(estimate).label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EstimateEditor({ params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id, estimateId } = use(params);
  const isNew = estimateId === "new";
  const router = useRouter();
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const existing = useLiveQuery(async () => {
    if (isNew || status !== "ready") return undefined;
    return (await getEstimate(estimateId)) ?? null;
  }, [isNew, estimateId, status]);
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const [created] = useState<Estimate | null>(() => (isNew ? blankEstimate(id) : null));
  const [edits, setEdits] = useState<Estimate | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined) return <PageFallback />;
  if (project === null) return <Missing />;
  if (!isNew) {
    if (existing === undefined) return <PageFallback />;
    if (existing === null || existing.projectId !== id) {
      return <EmptyState title="This estimate is not on this job" body="Takeoffs stay with the job they were written for." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/estimates`} />}>Back</Button>} />;
    }
  }
  const source = (isNew ? created : existing) as Estimate;
  const draft = edits ?? source;
  const labor = crewTime(draft);

  function update(partial: Partial<Estimate>) {
    setEdits((current) => ({ ...(current ?? source), ...partial }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    try {
      const saved = await saveEstimate({ ...draft, neededBy: draft.neededBy || null });
      toast.success("Estimate saved on this device");
      if (isNew) router.replace(`/projects/${id}/estimates/${saved.id}`);
      else setEdits(saved);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  async function exportPdf(mode: "download" | "preview") {
    if (!settings || !draft || !project) return;
    const bytes = await buildEstimatePdf({
      company: settings.companyName,
      preparedBy: settings.profileName,
      projectName: project.name,
      jobNumber: project.jobNumber,
      gc: project.gc,
      location: project.location,
      isSample: project.isSample,
      title: draft.title,
      scope: draft.scope,
      materials: draft.materials,
      crewSize: draft.crewSize,
      duration: draft.duration,
      durationUnit: draft.durationUnit,
      notes: draft.notes,
      neededBy: draft.neededBy,
      neededByConfirmation: draft.neededByConfirmation,
    });
    const name = estimatePdfFileName(project.name, draft.title || "takeoff");
    if (mode === "download") {
      downloadBytes(bytes, name);
      toast.success("PDF downloaded");
    } else setPreview({ bytes, name });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <ProjectTabs projectId={id} current="estimates" />
      <PageIntro
        eyebrow={project.name}
        title={isNew ? "New estimate" : draft.title || "Estimate"}
        description="Quantities and crew time only. This sheet is kept apart from daily reports, and it has no price column."
      />
      {draft.isSample ? <SampleBadge /> : null}
      <p className="rounded-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm font-bold">No pricing. Item, size, quantity, unit, and labor as crew size times duration.</p>
      <Field label="Title">
        <TextField value={draft.title} onChange={(event) => update({ title: event.target.value })} required />
      </Field>
      <Field label="Scope">
        <AreaField value={draft.scope} onChange={(event) => update({ scope: event.target.value })} className="min-h-32" />
      </Field>
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Materials</h2>
          <Button type="button" variant="outline" onClick={() => update({ materials: [...draft.materials, blankMaterialLine()] })}>
            Add line
          </Button>
        </div>
        {draft.materials.map((line, index) => (
          <div key={line.id} className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-border lg:grid-cols-[1.4fr_0.8fr_7rem_7rem_auto]">
            <Field label="Item">
              <TextField
                value={line.item}
                onChange={(event) => {
                  const materials = draft.materials.slice();
                  materials[index] = { ...line, item: event.target.value };
                  update({ materials });
                }}
              />
            </Field>
            <Field label="Size">
              <TextField
                value={line.size}
                onChange={(event) => {
                  const materials = draft.materials.slice();
                  materials[index] = { ...line, size: event.target.value };
                  update({ materials });
                }}
              />
            </Field>
            <Field label="Qty">
              <TextField
                inputMode="decimal"
                value={String(line.qty)}
                onChange={(event) => {
                  const materials = draft.materials.slice();
                  const qty = Number(event.target.value);
                  materials[index] = { ...line, qty: Number.isFinite(qty) ? qty : 0 };
                  update({ materials });
                }}
              />
            </Field>
            <Field label="Unit">
              <TextField
                value={line.unit}
                onChange={(event) => {
                  const materials = draft.materials.slice();
                  materials[index] = { ...line, unit: event.target.value };
                  update({ materials });
                }}
              />
            </Field>
            <Button type="button" variant="outline" className="self-end" onClick={() => update({ materials: draft.materials.filter((item) => item.id !== line.id) })}>
              Remove
            </Button>
          </div>
        ))}
      </section>
      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 className="font-display text-2xl font-bold">Labor</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">Crew size</span>
          <Button type="button" variant="outline" onClick={() => update({ crewSize: Math.max(0, draft.crewSize - 1) })}>
            −
          </Button>
          <span className="font-display min-w-10 text-center text-3xl font-bold">{draft.crewSize}</span>
          <Button type="button" variant="outline" onClick={() => update({ crewSize: draft.crewSize + 1 })}>
            +
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Duration">
            <TextField
              inputMode="decimal"
              value={String(draft.duration)}
              onChange={(event) => {
                const duration = Number(event.target.value);
                update({ duration: Number.isFinite(duration) ? duration : 0 });
              }}
            />
          </Field>
          <Field label="Unit">
            <SelectField value={draft.durationUnit} onChange={(event) => update({ durationUnit: event.target.value as DurationUnit })}>
              <option value="days">Days</option>
              <option value="hours">Hours</option>
            </SelectField>
          </Field>
        </div>
        <p className="font-display text-2xl font-bold">{labor.label}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Needed by">
          <TextField type="date" value={draft.neededBy ?? ""} onChange={(event) => update({ neededBy: event.target.value || null })} />
        </Field>
        <Field label="Needed-by status">
          <ConfirmationToggle value={draft.neededByConfirmation} onChange={(neededByConfirmation) => update({ neededByConfirmation })} />
        </Field>
      </div>
      {draft.neededBy ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Needed {formatDay(draft.neededBy)} <DateFlag value={draft.neededByConfirmation} />
        </p>
      ) : null}
      <Field label="Notes">
        <AreaField value={draft.notes} onChange={(event) => update({ notes: event.target.value })} />
      </Field>
      <InlineError message={formError} />
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap gap-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur md:bottom-4">
        <Button type="submit">Save estimate</Button>
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
            <DialogTitle className="font-display text-2xl">Estimate PDF</DialogTitle>
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
        title="Delete this estimate?"
        body="The daily reports on this job stay."
        confirmLabel="Delete estimate"
        onConfirm={() => {
          void deleteEstimate(draft.id).then(() => {
            toast.success("Estimate removed");
            router.push(`/projects/${id}/estimates`);
          });
        }}
      />
    </form>
  );
}

function Missing() {
  return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
}
