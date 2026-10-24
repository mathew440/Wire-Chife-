import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PageFallback({ label = "Opening the job book…" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 py-16">
      <div className="text-center">
        <p className="font-display text-2xl font-bold tracking-[0.18em] text-teal">WIRE CHIEF</p>
        <p className="mt-3 text-base text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function StorageError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-bold">This device blocked the job book</h1>
      <p className="mt-3 text-muted-foreground">
        Wire Chief keeps jobs in IndexedDB on this phone or computer. Nothing is sent to a server.
      </p>
      <p className="mt-3 text-sm text-orange">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/80 px-4 py-8">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-sm text-orange" role="alert">
      {message}
    </p>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      Try again
    </Button>
  );
}
