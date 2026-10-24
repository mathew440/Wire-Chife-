"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmationLabel } from "@/lib/domain/dates";
import type { Confirmation, ProjectStatus, TaskStatus } from "@/lib/data/types";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="10" fill="#0c121c" />
      <path d="M7 31c7-16 12-16 16.5 0S33 47 42 31" fill="none" stroke="#3ee0c5" strokeWidth="3" strokeLinecap="round" />
      <circle cx="36" cy="14" r="4" fill="#e8843a" />
    </svg>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex h-7 items-center rounded-md bg-orange px-2 text-xs font-bold tracking-wide text-orange-ink">
      SAMPLE
    </span>
  );
}

export function DateFlag({ value }: { value: Confirmation }) {
  const confirmed = value === "confirmed";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2 text-xs font-bold tracking-wide",
        confirmed ? "bg-teal text-teal-ink" : "bg-orange text-orange-ink",
      )}
    >
      {confirmationLabel(value)}
    </span>
  );
}

const projectTone: Record<ProjectStatus, string> = {
  unverified: "bg-orange text-orange-ink",
  bidding: "bg-orange text-orange-ink",
  active: "bg-teal text-teal-ink",
  punch: "bg-warn text-warn-ink",
  "on-hold": "bg-secondary text-foreground",
  complete: "bg-ok text-teal-ink",
};

const projectLabel: Record<ProjectStatus, string> = {
  unverified: "Needs verification",
  bidding: "Bidding",
  active: "Active",
  punch: "Punch",
  "on-hold": "On hold",
  complete: "Complete",
};

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-md px-2 text-xs font-bold tracking-wide", projectTone[status])}>
      {projectLabel[status]}
    </span>
  );
}

const taskTone: Record<TaskStatus, string> = {
  open: "bg-info/20 text-info",
  "in-progress": "bg-teal/15 text-teal",
  blocked: "bg-orange/20 text-orange",
  done: "bg-secondary text-muted-foreground",
};

const taskLabel: Record<TaskStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-md px-2 text-xs font-bold tracking-wide", taskTone[status])}>
      {taskLabel[status]}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm font-bold tracking-wide text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField(props: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("bg-background", props.className)} />;
}

export function AreaField(props: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={cn("bg-background", props.className)} />;
}

export function SelectField(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        props.className,
      )}
    />
  );
}

export function ConfirmationToggle({
  value,
  onChange,
}: {
  value: Confirmation;
  onChange: (value: Confirmation) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Date status">
      {(["tentative", "confirmed"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-12 rounded-lg border text-sm font-bold tracking-wide",
            value === option
              ? option === "confirmed"
                ? "border-teal bg-teal text-teal-ink"
                : "border-orange bg-orange text-orange-ink"
              : "border-border bg-background text-foreground",
          )}
        >
          {confirmationLabel(option)}
        </button>
      ))}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="font-display text-sm font-bold tracking-[0.16em] text-teal uppercase">{eyebrow}</p> : null}
        <h1 className="font-display text-4xl leading-none font-bold sm:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
