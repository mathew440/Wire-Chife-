import { keepQueueAfterFailure, markPushed, mergeRecords, outboundQueue, remoteWins, type SyncRecord } from "@/lib/sync/merge";
import { recordPayload, storagePathFor } from "@/lib/sync/records";
import { describe, expect, it } from "vitest";

function row(partial: Partial<SyncRecord> & Pick<SyncRecord, "id">): SyncRecord {
  return {
    table: "projects",
    updatedAt: "2026-10-25T12:00:00.000Z",
    rev: 1,
    deletedAt: null,
    syncState: "pending",
    ...partial,
  };
}

describe("shared sync merge", () => {
  it("keeps the later edit and uses rev when the time matches", () => {
    const older = row({ id: "job-a", updatedAt: "2026-10-24T12:00:00.000Z", rev: 4 });
    const newer = row({ id: "job-a", updatedAt: "2026-10-25T12:00:00.000Z", rev: 1, syncState: "synced" });
    expect(remoteWins(older, newer)).toBe(true);
    expect(remoteWins(newer, older)).toBe(false);
    const sameTime = row({ id: "job-a", rev: 3, syncState: "synced" });
    expect(remoteWins(row({ id: "job-a", rev: 2 }), sameTime)).toBe(true);
    expect(remoteWins(row({ id: "job-a", rev: 3 }), sameTime)).toBe(false);
  });

  it("lets a newer tombstone win and keeps a newer local edit over an older delete", () => {
    const local = row({ id: "job-a", updatedAt: "2026-10-20T00:00:00.000Z", rev: 2 });
    const tombstone = row({
      id: "job-a",
      updatedAt: "2026-10-26T00:00:00.000Z",
      rev: 3,
      deletedAt: "2026-10-26T00:00:00.000Z",
      syncState: "synced",
    });
    const merged = mergeRecords([local], [tombstone]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.deletedAt).toBe("2026-10-26T00:00:00.000Z");
    expect(merged[0]?.syncState).toBe("synced");

    const freshEdit = row({ id: "job-a", updatedAt: "2026-10-27T00:00:00.000Z", rev: 4, syncState: "pending" });
    const kept = mergeRecords([freshEdit], [tombstone]);
    expect(kept[0]?.deletedAt).toBeNull();
    expect(kept[0]?.syncState).toBe("pending");
  });

  it("does not duplicate a job uploaded twice from the same ids", () => {
    const first = row({ id: "sample-job-a", table: "projects", syncState: "synced" });
    const orders = row({ id: "order-1", table: "orders", syncState: "synced" });
    const once = mergeRecords([], [first, orders]);
    const twice = mergeRecords(once, [first, orders, { ...first, rev: 1 }]);
    expect(twice).toHaveLength(2);
    expect(twice.map((item) => `${item.table}:${item.id}`).sort()).toEqual(["orders:order-1", "projects:sample-job-a"]);
  });

  it("keeps an offline queue when the push fails and clears it only after success", () => {
    const pending = [
      row({ id: "job-a", syncState: "pending" }),
      row({ id: "job-b", syncState: "synced" }),
      row({ id: "job-c", syncState: "local" }),
    ];
    expect(outboundQueue(pending).map((item) => item.id)).toEqual(["job-a", "job-c"]);
    expect(outboundQueue(keepQueueAfterFailure(pending)).map((item) => item.id)).toEqual(["job-a", "job-c"]);
    const acked = markPushed(pending, [{ table: "projects", id: "job-a" }], "mathew@akaelectricinc.com");
    expect(outboundQueue(acked).map((item) => item.id)).toEqual(["job-c"]);
    expect(acked.find((item) => item.id === "job-a")?.updatedBy).toBe("mathew@akaelectricinc.com");
    expect(acked.find((item) => item.id === "job-b")?.syncState).toBe("synced");
  });

  it("stores a file path and leaves the bytes out of the shared record", () => {
    expect(storagePathFor("attachments", "file-1", "Panel wall.jpg")).toBe("attachments/file-1/Panel_wall.jpg");
    const payload = recordPayload({
      id: "file-1",
      fileName: "Panel wall.jpg",
      blob: new Blob(["bytes"], { type: "image/jpeg" }),
      storagePath: "attachments/file-1/Panel_wall.jpg",
    });
    expect(payload).not.toHaveProperty("blob");
    expect(payload.storagePath).toBe("attachments/file-1/Panel_wall.jpg");
    expect(payload.fileName).toBe("Panel wall.jpg");
  });
});
