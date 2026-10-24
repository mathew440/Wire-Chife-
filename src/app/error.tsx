"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-lg gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Wire Chief hit a snag</h1>
      <p className="text-muted-foreground">{error.message || "Something on this page failed."}</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
