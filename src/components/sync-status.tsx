"use client";

import { AppLink as Link } from "@/components/app-link";
import { syncLabel, subscribeSync, getSyncSnapshot } from "@/lib/sync/status";
import { cn } from "cn";
import { useSyncExternalStore } from "react";

export function SyncStatusLink({ className }: { className?: string }) {
  const snapshot = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
  if (!snapshot.ready) return null;
  const label = syncLabel(snapshot.phase);
  const href = snapshot.phase === "needs-sign-in" ? "/sign-in" : "/data";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-bold",
        snapshot.phase === "synced" ? "bg-teal/15 text-teal" : "bg-orange/15 text-orange",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function LastEdited({ by }: { by?: string }) {
  if (!by) return null;
  return <p className="text-sm text-muted-foreground">Last edited by {by}</p>;
}
