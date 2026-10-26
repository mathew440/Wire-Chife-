"use client";

import { Field, PageIntro, SampleBadge, SelectField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { PdfCanvas, ZoomImage } from "@/components/pdf-view";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankAttachment } from "@/lib/data/factories";
import {
  deleteAttachment,
  getAttachment,
  getProject,
  listAttachments,
  listEstimates,
  listReports,
  listTasks,
  saveAttachment,
} from "@/lib/data/repo";
import { formatDay } from "@/lib/domain/dates";
import { isImage, isPdf, prepareUpload } from "@/lib/files/prepare";
import { ensureAttachmentCached } from "@/lib/sync/engine";
import type { AttachmentParent } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link, useAppRouter as useRouter } from "@/components/app-link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

export function FileList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const files = useLiveQuery(() => listAttachments(id), [id]);
  const reports = useLiveQuery(() => listReports(id), [id]);
  const tasks = useLiveQuery(() => listTasks(id), [id]);
  const estimates = useLiveQuery(() => listEstimates(id), [id]);
  const [parent, setParent] = useState("project");
  const [formError, setFormError] = useState<string | null>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !files || !reports || !tasks || !estimates) return <PageFallback />;
  if (project === null) return <Missing />;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFormError(null);
    try {
      const prepared = await prepareUpload(file);
      const [parentType, parentId] = parent.split(":");
      await saveAttachment(
        blankAttachment(id, {
          parentType: (parentType || "project") as AttachmentParent,
          parentId: parentId || id,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          blob: prepared.blob,
        }),
      );
      toast.success("File saved on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not attach");
    }
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="files" />
      <PageIntro
        eyebrow={project.name}
        title="Files"
        description="Photos and PDF drawings stay on this job. Open a PDF to pinch-zoom it."
      />
      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <Field label="Attach to">
          <SelectField value={parent} onChange={(event) => setParent(event.target.value)}>
            <option value="project">This job</option>
            {reports.map((report) => (
              <option key={report.id} value={`report:${report.id}`}>
                Report {formatDay(report.date)}
              </option>
            ))}
            {tasks.map((task) => (
              <option key={task.id} value={`task:${task.id}`}>
                Item: {task.title}
              </option>
            ))}
            {estimates.map((estimate) => (
              <option key={estimate.id} value={`estimate:${estimate.id}`}>
                Estimate: {estimate.title}
              </option>
            ))}
          </SelectField>
        </Field>
        <label className="grid gap-2">
          <span className="text-sm font-bold">Photo or PDF</span>
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
        <InlineError message={formError} />
      </div>
      {files.length === 0 ? (
        <EmptyState title="No files on this job" body="Drawings and photos you add here do not show up on any other job." />
      ) : (
        <ul className="grid gap-3">
          {files.map((file) => (
            <li key={file.id}>
              <Link href={`/projects/${id}/files/${file.id}`} className="grid gap-1 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{file.fileName}</span>
                  {file.isSample ? <SampleBadge /> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isPdf(file.mimeType, file.fileName) ? "PDF" : "Photo"} · {whereAttached(file.parentType)} · {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FileViewer({ params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = use(params);
  const router = useRouter();
  const { status, error } = useDbReady();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const file = useLiveQuery(async () => {
    if (status !== "ready") return undefined;
    return (await getAttachment(fileId)) ?? null;
  }, [fileId, status]);
  const [url, setUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!file || file.projectId !== id) return;
    if (file.blob.size === 0) void ensureAttachmentCached(file.id);
    let cancelled = false;
    const objectUrl = URL.createObjectURL(file.blob);
    const pdf = isPdf(file.mimeType, file.fileName);
    const blob = file.blob;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setUrl(objectUrl);
      if (!pdf) setPdfBytes(null);
    });
    if (pdf) {
      void blob.arrayBuffer().then((buffer) => {
        if (!cancelled) setPdfBytes(new Uint8Array(buffer));
      });
    }
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, id]);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || file === undefined) return <PageFallback />;
  if (project === null) return <Missing />;
  if (file === null || file.projectId !== id) {
    return <EmptyState title="This file is not on this job" body="Files do not cross from one job to another." action={<Button nativeButton={false} render={<Link href={`/projects/${id}/files`} />}>Back to files</Button>} />;
  }

  return (
    <div className="grid gap-4">
      <ProjectTabs projectId={id} current="files" />
      <PageIntro eyebrow={project.name} title={file.fileName} description={`${whereAttached(file.parentType)}. Pinch or use the zoom buttons.`} />
      <div className="flex flex-wrap gap-2">
        {file.isSample ? <SampleBadge /> : null}
        <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${id}/files`} />}>
          Back to files
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            void deleteAttachment(file.id).then(() => {
              toast.success("File removed");
              router.push(`/projects/${id}/files`);
            });
          }}
        >
          Delete file
        </Button>
      </div>
      {pdfBytes ? <PdfCanvas data={pdfBytes} /> : null}
      {!pdfBytes && url && isImage(file.mimeType) ? <ZoomImage src={url} alt={file.fileName} /> : null}
      {!pdfBytes && url && !isImage(file.mimeType) && !isPdf(file.mimeType, file.fileName) ? (
        <a className="font-semibold text-teal" href={url} download={file.fileName}>
          Download {file.fileName}
        </a>
      ) : null}
    </div>
  );
}

function whereAttached(parent: AttachmentParent): string {
  if (parent === "report") return "On a daily report";
  if (parent === "task") return "On an open item";
  if (parent === "estimate") return "On an estimate";
  if (parent === "photo") return "Photo log";
  return "On the job";
}

function Missing() {
  return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
}
