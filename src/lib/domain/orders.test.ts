import { blankOrder } from "@/lib/data/factories";
import { isDueSoonOrder, isLateOrder } from "@/lib/domain/orders";
import { describe, expect, it } from "vitest";

describe("material orders", () => {
  const today = "2026-10-24";

  it("flags a past expected date that is not delivered, and a date inside 7 days", () => {
    const late = blankOrder("job-a", { status: "shipped", expectedDate: "2026-10-20" });
    const soon = blankOrder("job-a", { status: "ordered", expectedDate: "2026-10-28" });
    const arrived = blankOrder("job-a", { status: "delivered", expectedDate: "2026-10-01", deliveredDate: "2026-10-22" });
    const noDate = blankOrder("job-a", { status: "needed", expectedDate: null });
    const later = blankOrder("job-a", { status: "backordered", expectedDate: "2026-12-01" });

    expect(isLateOrder(late, today)).toBe(true);
    expect(isDueSoonOrder(late, today)).toBe(false);
    expect(isDueSoonOrder(soon, today)).toBe(true);
    expect(isLateOrder(soon, today)).toBe(false);
    expect(isLateOrder(arrived, today)).toBe(false);
    expect(isLateOrder(noDate, today)).toBe(false);
    expect(isDueSoonOrder(noDate, today)).toBe(false);
    expect(isDueSoonOrder(later, today)).toBe(false);
    expect(isLateOrder(blankOrder("job-a", { status: "backordered", expectedDate: "2026-10-01" }), today)).toBe(true);
  });
});
