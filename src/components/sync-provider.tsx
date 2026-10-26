"use client";

import { Button } from "@/components/ui/button";
import { chooseUpload, startSync } from "@/lib/sync/engine";
import { getSyncSnapshot, subscribeSync } from "@/lib/sync/status";
import { useEffect, useSyncExternalStore } from "react";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);

  useEffect(() => startSync(), []);

  return (
    <>
      {children}
      {snapshot.askUpload ? (
        <div className="fixed inset-0 z-50 grid items-end bg-black/50 p-4 sm:items-center sm:justify-center">
          <div className="grid w-full max-w-md gap-4 rounded-xl bg-card p-5 shadow-lg" role="dialog" aria-labelledby="upload-title">
            <h2 id="upload-title" className="font-display text-2xl font-bold">
              Upload this phone&apos;s jobs to the shared database?
            </h2>
            <p className="text-base text-muted-foreground">
              Jobs already shared stay. Nothing on this phone is deleted. Choose No to keep this phone&apos;s current jobs here until you edit them. After that, new edits are shared.
            </p>
            <Button type="button" onClick={() => void chooseUpload("yes")}>
              Yes, upload
            </Button>
            <Button type="button" variant="outline" onClick={() => void chooseUpload("no")}>
              No
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
