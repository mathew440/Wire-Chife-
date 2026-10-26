import type { SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import { db } from "@/lib/data/db";
import type { Attachment, DeviceSync, EntityMeta } from "@/lib/data/types";
import { getSupabase } from "@/lib/sync/client";
import { FILES_BUCKET, isKnownEmail, normalizeEmail } from "@/lib/sync/config";
import { remoteWins } from "@/lib/sync/merge";
import { emptyBlob, isSyncTable, recordPayload, storagePathFor, SYNC_TABLES, type SyncTableName } from "@/lib/sync/records";
import { getSyncSnapshot, patchSync, type SyncPhase } from "@/lib/sync/status";

interface RemoteRow {
  table_name: string;
  id: string;
  data: Record<string, unknown>;
  rev: number;
  deleted_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

const PAGE = 400;
let started = false;
let running = false;
let queued = false;
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: { unsubscribe: () => void } | null = null;
let online = true;

function syncTables(): Array<[SyncTableName, Table<EntityMeta, string>]> {
  return SYNC_TABLES.map((name) => [name, db[name] as Table<EntityMeta, string>]);
}

export function scheduleSync(): void {
  if (typeof window === "undefined") return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  void runSync();
}

export async function syncNow(): Promise<void> {
  attempt = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const session = (await getSupabase()?.auth.getSession())?.data.session;
  if (!session) throw new Error("Sign in to share this phone's jobs.");
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("You are offline. Jobs on this phone are still here.");
  await runSync();
  const error = getSyncSnapshot().lastError;
  if (error) throw new Error(error);
}

export async function chooseUpload(choice: "yes" | "no"): Promise<void> {
  if (choice === "no") await settleLocalRows();
  await db.deviceSync.put({ id: "local", cursor: (await readDevice()).cursor, uploadChoice: choice });
  patchSync({ askUpload: false });
  scheduleSync();
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  channel?.unsubscribe();
  channel = null;
  await supabase?.auth.signOut();
  patchSync({ ready: true, phase: "needs-sign-in", email: null, askUpload: false, lastError: null });
}

export function startSync(): () => void {
  if (started || typeof window === "undefined") return () => undefined;
  started = true;
  online = navigator.onLine;
  const onOnline = () => {
    online = true;
    scheduleSync();
  };
  const onOffline = () => {
    online = false;
    void refreshPhase();
  };
  const onFocus = () => {
    if (document.visibilityState === "visible") scheduleSync();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
  const supabase = getSupabase();
  const { data: auth } = supabase?.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      channel?.unsubscribe();
      channel = null;
      patchSync({ ready: true, phase: "needs-sign-in", email: null, askUpload: false });
      return;
    }
    patchSync({ email: normalizeEmail(session.user.email ?? ""), ready: true });
    void afterSignIn();
  }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

  return () => {
    started = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    auth.subscription.unsubscribe();
    channel?.unsubscribe();
    channel = null;
  };
}

async function afterSignIn(): Promise<void> {
  const supabase = getSupabase();
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!supabase || !session?.user.email) {
    patchSync({ ready: true, phase: "needs-sign-in", email: null, askUpload: false });
    return;
  }
  const email = normalizeEmail(session.user.email);
  patchSync({ ready: true, email });
  const access = await probeAccess(supabase, email);
  if (access === "unreachable") {
    patchSync({ phase: navigator.onLine ? "syncing" : "offline", lastError: "Can't reach the shared database right now. Jobs on this phone are still here." });
    scheduleRetry();
    return;
  }
  if (access === "not-allowed") {
    await supabase.auth.signOut();
    patchSync({
      ready: true,
      phase: "needs-sign-in",
      email: null,
      askUpload: false,
      lastError: "This email isn't set up for Wire Chief. Ask Mat.",
    });
    return;
  }
  patchSync({ lastError: null });
  await ensureUploadChoice();
  listen(supabase);
  scheduleSync();
}

async function probeAccess(supabase: SupabaseClient, email: string): Promise<"ok" | "not-allowed" | "unreachable"> {
  const { data, error } = await supabase.from("records").select("id").limit(1);
  if (error) return networkError(error.message) ? "unreachable" : "not-allowed";
  if ((data ?? []).length > 0) return "ok";
  const listed = await supabase.from("allowed_users").select("email").eq("email", email).limit(1);
  if (!listed.error && (listed.data ?? []).length > 0) return "ok";
  if (isKnownEmail(email)) return "ok";
  return "not-allowed";
}

function networkError(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("fetch") || text.includes("network") || text.includes("failed to") || text.includes("timeout");
}

async function ensureUploadChoice(): Promise<void> {
  const device = await readDevice();
  if (device.uploadChoice) {
    patchSync({ askUpload: false });
    return;
  }
  const hasRows = await localBookHasRows();
  if (!hasRows) {
    await db.deviceSync.put({ ...device, uploadChoice: "yes" });
    patchSync({ askUpload: false });
    return;
  }
  patchSync({ askUpload: true });
}

async function localBookHasRows(): Promise<boolean> {
  for (const [, table] of syncTables()) {
    if ((await table.count()) > 0) return true;
  }
  return false;
}

async function settleLocalRows(): Promise<void> {
  await db.transaction("rw", syncTables().map(([, table]) => table), async () => {
    for (const [, table] of syncTables()) {
      const rows = await table.toArray();
      for (const row of rows) {
        if (row.syncState !== "synced") await table.update(row.id, { syncState: "synced" });
      }
    }
  });
}

function listen(supabase: SupabaseClient): void {
  channel?.unsubscribe();
  channel = supabase
    .channel("wire-chief-records")
    .on("postgres_changes", { event: "*", schema: "public", table: "records" }, () => scheduleSync())
    .subscribe();
}

async function runSync(): Promise<void> {
  if (typeof window === "undefined") return;
  if (running) {
    queued = true;
    return;
  }
  const supabase = getSupabase();
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!supabase || !session) {
    patchSync({ ready: true, phase: "needs-sign-in", email: null });
    return;
  }
  if (!online || !navigator.onLine) {
    patchSync({ phase: "offline", email: normalizeEmail(session.user.email ?? "") });
    return;
  }
  const device = await readDevice();
  running = true;
  patchSync({ phase: "syncing", email: normalizeEmail(session.user.email ?? ""), lastError: null });
  try {
    if (device.uploadChoice) await pushAll(supabase);
    await pullAll(supabase);
    attempt = 0;
    await refreshPhase();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Sync did not finish. This phone's jobs are still here.";
    patchSync({ lastError: message, phase: navigator.onLine ? "syncing" : "offline" });
    scheduleRetry();
  } finally {
    running = false;
    if (queued) {
      queued = false;
      void runSync();
    }
  }
}

function scheduleRetry(): void {
  if (timer) clearTimeout(timer);
  const delay = Math.min(30_000, 1000 * 2 ** attempt);
  attempt += 1;
  timer = setTimeout(() => {
    timer = null;
    void runSync();
  }, delay);
}

async function pushAll(supabase: SupabaseClient): Promise<void> {
  for (const [name, table] of syncTables()) {
    const rows = (await table.toArray()).filter((row) => row.syncState !== "synced");
    for (const row of rows) {
      let payload = recordPayload(row);
      if (name === "attachments") {
        const file = row as Attachment;
        if (file.blob && file.blob.size > 0) {
          const path = file.storagePath || storagePathFor(name, file.id, file.fileName);
          const uploaded = await supabase.storage.from(FILES_BUCKET).upload(path, file.blob, {
            upsert: true,
            contentType: file.mimeType || "application/octet-stream",
          });
          if (uploaded.error) throw new Error(uploaded.error.message);
          payload = { ...payload, storagePath: path };
          await db.attachments.update(file.id, { storagePath: path });
        }
      }
      const { data, error } = await supabase
        .from("records")
        .upsert(
          {
            table_name: name,
            id: row.id,
            data: payload,
            rev: row.rev,
            deleted_at: row.deletedAt,
          },
          { onConflict: "table_name,id" },
        )
        .select("updated_by")
        .single();
      if (error) throw new Error(error.message);
      const current = await table.get(row.id);
      if (current && current.rev === row.rev && current.updatedAt === row.updatedAt) {
        await table.update(row.id, { syncState: "synced", updatedBy: data?.updated_by || current.updatedBy });
      }
    }
  }
}

async function pullAll(supabase: SupabaseClient): Promise<void> {
  let cursor = (await readDevice()).cursor;
  for (;;) {
    let query = supabase.from("records").select("*").order("updated_at", { ascending: true }).limit(PAGE);
    if (cursor) query = query.gt("updated_at", cursor);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as RemoteRow[];
    if (rows.length === 0) break;
    for (const remote of rows) await applyRemote(remote);
    cursor = rows[rows.length - 1]?.updated_at ?? cursor;
    const device = await readDevice();
    await db.deviceSync.put({ ...device, cursor });
    if (rows.length < PAGE) break;
  }
}

async function applyRemote(remote: RemoteRow): Promise<void> {
  if (!isSyncTable(remote.table_name) || !remote.data || typeof remote.data !== "object") return;
  const table = db[remote.table_name] as Table<EntityMeta, string>;
  const local = await table.get(remote.id);
  const incoming = remote.data;
  const updatedAt = typeof incoming.updatedAt === "string" ? incoming.updatedAt : remote.updated_at;
  const rev = typeof incoming.rev === "number" ? incoming.rev : remote.rev;
  const deletedAt = typeof incoming.deletedAt === "string" ? incoming.deletedAt : incoming.deletedAt === null ? null : remote.deleted_at;
  if (local && !remoteWins(local, { updatedAt, rev })) return;
  const next = {
    ...incoming,
    id: remote.id,
    updatedAt,
    rev,
    deletedAt,
    syncState: "synced",
    updatedBy: remote.updated_by || undefined,
  } as EntityMeta;
  if (remote.table_name === "attachments") {
    const localFile = local as Attachment | undefined;
    const mimeType = typeof incoming.mimeType === "string" ? incoming.mimeType : "application/octet-stream";
    const blob = localFile?.blob && localFile.blob.size > 0 ? localFile.blob : emptyBlob(mimeType);
    await table.put({ ...next, blob } as EntityMeta);
    return;
  }
  await table.put(next);
}

async function readDevice(): Promise<DeviceSync> {
  return (await db.deviceSync.get("local")) ?? { id: "local", cursor: null, uploadChoice: null };
}

async function refreshPhase(): Promise<void> {
  const session = (await getSupabase()?.auth.getSession())?.data.session;
  if (!session) {
    patchSync({ phase: "needs-sign-in", email: null });
    return;
  }
  if (!navigator.onLine) {
    patchSync({ phase: "offline" });
    return;
  }
  let pending = 0;
  const device = await readDevice();
  if (device.uploadChoice) {
    for (const [, table] of syncTables()) {
      const rows = await table.toArray();
      pending += rows.filter((row) => row.syncState !== "synced").length;
    }
  }
  const phase: SyncPhase = pending > 0 || running ? "syncing" : "synced";
  patchSync({ phase, email: normalizeEmail(session.user.email ?? "") });
}

export async function ensureAttachmentCached(id: string): Promise<void> {
  const row = await db.attachments.get(id);
  if (!row || row.deletedAt || (row.blob && row.blob.size > 0) || !row.storagePath) return;
  const supabase = getSupabase();
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!supabase || !session) return;
  const downloaded = await supabase.storage.from(FILES_BUCKET).download(row.storagePath);
  if (downloaded.error || !downloaded.data) return;
  const current = await db.attachments.get(id);
  if (!current || current.rev !== row.rev) return;
  await db.attachments.update(id, { blob: downloaded.data, size: downloaded.data.size });
}
