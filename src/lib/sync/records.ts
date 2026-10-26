
/** Job records that move through the shared table. Settings and the change log stay on the phone. */
export const SYNC_TABLES = [
  "projects",
  "people",
  "assignments",
  "reports",
  "tasks",
  "estimates",
  "schedule",
  "attachments",
  "logItems",
  "orders",
  "laborBudgets",
  "timeEntries",
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

export function isSyncTable(value: string): value is SyncTableName {
  return (SYNC_TABLES as readonly string[]).includes(value);
}

export function storagePathFor(table: string, id: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "file";
  return `${table}/${id}/${safe}`;
}

/** Json stored in the shared table. File bytes never go in this object. */
export function recordPayload(row: object): Record<string, unknown> {
  const payload = { ...(row as Record<string, unknown>) };
  delete payload.blob;
  return payload;
}

export function emptyBlob(mimeType: string): Blob {
  return new Blob([], { type: mimeType || "application/octet-stream" });
}
