import type { LogItem, LogStatus } from "@/lib/data/types";
import { addDays } from "@/lib/domain/dates";

export const DUE_SOON_DAYS = 7;

export const LOG_STATUS_OPTIONS: Array<{ value: LogStatus; label: string }> = [
  { value: "not-submitted", label: "Not submitted" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "approved-as-noted", label: "Approved as noted" },
  { value: "revise-resubmit", label: "Revise & resubmit" },
  { value: "rejected", label: "Rejected" },
];

export function logStatusLabel(status: LogStatus): string {
  return LOG_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function isClosedLog(status: LogStatus): boolean {
  return status === "approved" || status === "approved-as-noted";
}

export function isOverdueLog(item: Pick<LogItem, "status" | "dueDate" | "deletedAt">, today: string): boolean {
  if (item.deletedAt || !item.dueDate || isClosedLog(item.status)) return false;
  return item.dueDate < today;
}

export function isDueSoonLog(item: Pick<LogItem, "status" | "dueDate" | "deletedAt">, today: string): boolean {
  if (item.deletedAt || !item.dueDate || isClosedLog(item.status)) return false;
  return item.dueDate >= today && item.dueDate <= addDays(today, DUE_SOON_DAYS);
}
