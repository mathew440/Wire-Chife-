"use client";

import { Field, PageIntro, TextField } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backupFileName, exportBackup, importBackup, type BackupFile } from "@/lib/data/backup";
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

  async function restore(file: File | undefined) {
    if (!file) return;
    setFormError(null);
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      await importBackup(parsed);
      toast.success("Backup restored on this device");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not restore that file");
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
              Jobs live in this phone&apos;s storage, not on a server. Export a JSON file of every job, photo, and PDF before you clear the browser. On iPhone, share it into Files. Restore replaces what is on this device.
            </p>
            <Button type="button" onClick={() => void download()}>
              Export backup
            </Button>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Import a backup</span>
              <input
                type="file"
                accept="application/json"
                className="block h-12 w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-bold"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void restore(file);
                  event.target.value = "";
                }}
              />
            </label>
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
