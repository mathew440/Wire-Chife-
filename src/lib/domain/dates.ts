import type { Confirmation, ScheduleConfirmation } from "@/lib/data/types";

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

export function dayOffset(iso: string, today: string): number {
  const [y1, m1, d1] = iso.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((a - b) / 86_400_000);
}

export function formatDay(iso: string, today = todayISO()): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const sameYear = String(y) === today.slice(0, 4);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function duePhrase(iso: string, today: string): string {
  const offset = dayOffset(iso, today);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  if (offset > 1) return `In ${offset} days`;
  return `${Math.abs(offset)} days overdue`;
}

export function isConfirmation(value: string): value is Confirmation {
  return value === "tentative" || value === "confirmed";
}

export function isScheduleConfirmation(value: string): value is ScheduleConfirmation {
  return value === "tentative" || value === "confirmed" || value === "needs-verification";
}

export function confirmationLabel(value: ScheduleConfirmation): "TENTATIVE" | "CONFIRMED" | "NEEDS VERIFICATION" {
  if (value === "confirmed") return "CONFIRMED";
  if (value === "needs-verification") return "NEEDS VERIFICATION";
  return "TENTATIVE";
}
