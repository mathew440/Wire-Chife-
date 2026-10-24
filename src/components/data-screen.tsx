"use client";

import { ConfirmDialog, Field, PageIntro, TextField } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backupFileName, exportBackup, importBackup, importJob, jobsInBackup, type BackupFile } from "@/lib/data/backup";
import { getSettings, listChangelog, removeSampleData, saveSettings } from "@/lib/data/repo";
import { foremanDisplay, preparedByLabel, SEEDED_PROFILE_NAME, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import { localOnlySync } from "@/lib/sync/adapter";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function DataScreen() {
  const { status, error } = useDbReady();
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const changes = useLiveQuery(() => (status === "ready" ? listChangelog() : undefined), [status]);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [foreman, setForeman] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [replaceFile, setReplaceFile] = useState<BackupFile | null>(null);
  const [mergeFile, setMergeFile] = useState<BackupFile | null>(null);
  const [mergeJobId, setMergeJobId] = useState<string | null>(null);
  const offline = useOffline();

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !settings || !changes) return <PageFallback />;

  const profileName = name ?? settings.profileName;
  const profileRole = role ?? settings.profileRole;
  const foremanName = foreman ?? settings.foremanName;
  const companyName = company ?? settings.companyName;

  async function saveProfile() {
    await saveSettings({
      ...settings!,
      profileName: profileName.trim() || SEEDED_PROFILE_NAME,
      profileRole: profileRole.trim() || SEEDED_PROFILE_ROLE,
      foremanName: foremanName.trim(),
      companyName: companyName.trim() || "AKA Electric",
    });
    toast.success("Profile saved on this device");
  }

  async function download() {
    const backup = await exportBackup();
    const fileName = backupFileName(backup.exportedAt);
    const file = new File([JSON.stringify(backup)], fileName, { type: "application/json" });
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Wire Chief backup" });
        toast.success("Backup ready. Save it in Files.");
        return;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success("Backup downloaded");
  }

  async function readBackup(file: File | undefined): Promise<BackupFile | null> {
    if (!file) return null;
    setFormError(null);
    try {
      return JSON.parse(await file.text()) as BackupFile;
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not read that file");
      return null;
    }
  }

  async function confirmReplace() {
    if (!replaceFile) return;
    try {
      await importBackup(replaceFile);
      setReplaceFile(null);
      setReplaceArmed(false);
      toast.success("Backup replaced the book on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not restore that file");
    }
  }

  async function confirmMerge() {
    if (!mergeFile || !mergeJobId) return;
    try {
      const chosen = jobsInBackup(mergeFile).find((job) => job.id === mergeJobId);
      await importJob(mergeFile, mergeJobId);
      setMergeJobId(null);
      toast.success(chosen ? `${chosen.name} added on this device` : "Job added on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not add that job");
    }
  }

  return (
    <div className="grid gap-5">
      <PageIntro
        eyebrow={localOnlySync.id === "local-only" ? "Local only" : "Sync"}
        title="Data"
        description="The job book lives in IndexedDB on this phone or computer. There is no account and no server in this version."
      />
      {offline ? (
        <p className="rounded-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm">
          You are offline. Jobs already opened on this device still work. A page you have never opened may wait until you have signal again.
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">This device</h2>
            <Field label="Your name">
              <TextField value={profileName} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Your role">
              <TextField value={profileRole} onChange={(event) => setRole(event.target.value)} />
            </Field>
            <Field label="Foreman" hint="Separate from the project manager. Leave blank until the name is verified.">
              <TextField value={foremanName} placeholder="Needs verification" onChange={(event) => setForeman(event.target.value)} />
            </Field>
            <Field label="Company">
              <TextField value={companyName} onChange={(event) => setCompany(event.target.value)} />
            </Field>
            <Button type="button" onClick={() => void saveProfile()}>
              Save profile
            </Button>
            <p className="text-sm text-muted-foreground">
              Reports say Prepared by {preparedByLabel(profileName, profileRole)}. Foreman: {foremanDisplay(foremanName)}.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Backup</h2>
            <p className="text-sm text-muted-foreground">
              Jobs, photos, and logs live in this phone&apos;s storage. Export a JSON file before you change phones. On iPhone, share it into Files.
            </p>
            <Button type="button" onClick={() => void download()}>
              Export backup
            </Button>
            <div className="grid gap-2 rounded-lg bg-background p-3 ring-1 ring-border">
              <h3 className="font-display text-xl font-bold">Add one job</h3>
              <p className="text-sm text-muted-foreground">
                Other jobs on this phone stay. The job you pick is added or updated. Your name and role are not replaced. Rows you added here that are not in the file stay too.
              </p>
              <label className="grid gap-2">
                <span className="text-sm font-bold">Choose a backup</span>
                <input
                  type="file"
                  accept="application/json"
                  className="block h-12 w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-bold"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void readBackup(file).then((parsed) => {
                      if (!parsed) return;
                      try {
                        const jobs = jobsInBackup(parsed);
                        if (jobs.length === 0) {
                          setFormError("That backup has no job to add.");
                          return;
                        }
                        setMergeFile(parsed);
                      } catch (caught) {
                        setFormError(caught instanceof Error ? caught.message : "Could not read that file");
                      }
                    });
                    event.target.value = "";
                  }}
                />
              </label>
              {mergeFile
                ? jobsInBackup(mergeFile).map((job) => (
                    <Button key={job.id} type="button" variant="outline" onClick={() => setMergeJobId(job.id)}>
                      Add {job.name}
                      {job.jobNumber ? ` · ${job.jobNumber}` : ""}
                    </Button>
                  ))
                : null}
            </div>
            <div className="grid gap-2 rounded-lg border border-orange/50 bg-orange/10 p-3">
              <h3 className="font-display text-xl font-bold">Replace every job</h3>
              <p className="text-sm">
                This wipes the book on this device and loads the file instead. Export a backup first. Jobs that are only on this phone will be gone.
              </p>
              <Button type="button" variant="outline" onClick={() => void download()}>
                Export a backup first
              </Button>
              {replaceArmed ? (
                <label className="grid gap-2">
                  <span className="text-sm font-bold">File that will replace everything</span>
                  <input
                    type="file"
                    accept="application/json"
                    className="block h-12 w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-bold"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void readBackup(file).then((parsed) => {
                        if (parsed) setReplaceFile(parsed);
                      });
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setReplaceArmed(true)}>
                  I exported. Replace everything
                </Button>
              )}
            </div>
            <InlineError message={formError} />
          </CardContent>
        </Card>
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Starter jobs</h2>
            <p className="text-sm text-muted-foreground">
              Jobs marked SAMPLE came from an earlier version of this app. Removing them leaves any job you created.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void removeSampleData().then(() => toast.success("Starter jobs removed"));
              }}
            >
              Remove starter jobs
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-card text-base">
          <CardContent className="grid gap-3">
            <h2 className="font-display text-2xl font-bold">Install and sync</h2>
            <p className="text-sm text-muted-foreground">
              On iPhone, open https://mathew440.github.io/Wire-Chife-/ in Safari, tap Share, then Add to Home Screen. The icon then opens full screen. Open it once while you have signal. After that, a job you have already opened still loads with no signal. The job book itself stays in IndexedDB on this phone. {localOnlySync.id === "local-only" ? "Nothing is uploaded." : ""} A change log ({changes.length} rows) is kept for a later sync service.
            </p>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={replaceFile !== null}
        onOpenChange={(open) => {
          if (!open) setReplaceFile(null);
        }}
        title="Replace every job on this device?"
        body="This erases the job book on this phone and loads the file instead. Export a backup first if you have not already."
        confirmLabel="Replace everything"
        onConfirm={() => void confirmReplace()}
      />
      <ConfirmDialog
        open={mergeJobId !== null}
        onOpenChange={(open) => {
          if (!open) setMergeJobId(null);
        }}
        title="Add this job?"
        body="Other jobs on this phone stay. Rows from the file are added or updated. Your profile is not replaced."
        confirmLabel="Add job"
        onConfirm={() => void confirmMerge()}
      />
    </div>
  );
}

function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return offline;
}
