"use client";

import { Field, PageIntro, TextField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankAttachment } from "@/lib/data/factories";
import { deleteAttachment, getProject, listAttachments, saveAttachment } from "@/lib/data/repo";
import { formatDay, todayISO } from "@/lib/domain/dates";
import { prepareUpload } from "@/lib/files/prepare";
import { ensureAttachmentCached } from "@/lib/sync/engine";
import type { Attachment } from "@/lib/data/types";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

export function PhotoLog({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? (await getProject(id)) ?? null : undefined), [id, status]);
  const files = useLiveQuery(() => listAttachments(id), [id]);
  const [area, setArea] = useState("");
  const [caption, setCaption] = useState("");
  const [takenDate, setTakenDate] = useState(today);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !files) return <PageFallback />;
  if (project === null) {
    return <EmptyState title="This job is not on this device" body="Head back to the job list." action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>} />;
  }

  const photos = files.filter((file) => file.parentType === "photo");
  const areas = groupByArea(photos);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFormError(null);
    try {
      const prepared = await prepareUpload(file);
      if (!prepared.mimeType.startsWith("image/")) {
        throw new Error("The photo log takes a photo. Put PDFs in Files.");
      }
      await saveAttachment(
        blankAttachment(id, {
          parentType: "photo",
          parentId: id,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          blob: prepared.blob,
          area: area.trim(),
          caption: caption.trim(),
          takenDate: takenDate || null,
        }),
      );
      setCaption("");
      toast.success("Photo saved on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the photo");
    }
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="photos" />
      <PageIntro
        eyebrow={project.name}
        title="Photo log"
        description="Photos stay on this phone, grouped by the area you type. They are reduced in size before they are saved so a backup stays practical."
      />
      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Area">
            <TextField value={area} onChange={(event) => setArea(event.target.value)} placeholder="Room or area" />
          </Field>
          <Field label="Date">
            <TextField type="date" value={takenDate} onChange={(event) => setTakenDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Caption">
          <TextField value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What the photo shows" />
        </Field>
        <label className="grid gap-2">
          <span className="text-sm font-bold">Add a photo</span>
          <input
            type="file"
            accept="image/*"
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
      {photos.length === 0 ? (
        <EmptyState title="No photos on this job" body="Add a photo with an area and a caption. It stays on this phone, and it is shared when you are signed in." />
      ) : (
        <div className="grid gap-5">
          {areas.map(([name, rows]) => (
            <section key={name} className="grid gap-3">
              <h2 className="font-display text-2xl font-bold">{name}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {rows.map((photo) => (
                  <li key={photo.id} className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-border">
                    <PhotoThumb id={photo.id} blob={photo.blob} alt={photo.caption || photo.fileName} />
                    <p className="font-semibold">{photo.caption || "No caption"}</p>
                    <p className="text-sm text-muted-foreground">
                      {photo.takenDate ? formatDay(photo.takenDate, today) : "No date"} · {Math.max(1, Math.round(photo.size / 1024))} KB
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void deleteAttachment(photo.id).then(() => toast.success("Photo removed"));
                      }}
                    >
                      Remove photo
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByArea(photos: Attachment[]): Array<[string, Attachment[]]> {
  const groups = new Map<string, Attachment[]>();
  for (const photo of photos) {
    const name = photo.area.trim() || "No area";
    const list = groups.get(name) ?? [];
    list.push(photo);
    groups.set(name, list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "No area") return 1;
    if (b === "No area") return -1;
    return a.localeCompare(b);
  });
}

function PhotoThumb({ id, blob, alt }: { id: string; blob: Blob; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blob.size > 0) return;
    void ensureAttachmentCached(id);
  }, [blob.size, id]);
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  if (blob.size === 0) return <div className="grid h-40 place-items-center rounded-lg bg-background px-3 text-center text-sm">This photo downloads when you are signed in.</div>;
  if (!url) return <div className="h-40 rounded-lg bg-background" />;
  return (
    // Local photo bytes. next/image cannot read a blob URL in the static export.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-40 w-full rounded-lg object-cover" />
  );
}
