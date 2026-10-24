import type { DurationUnit, Estimate, MaterialLine } from "@/lib/data/types";

/** Quantity takeoff only. There is no price, rate, or cost on an estimate. */
export const MATERIAL_LINE_FIELDS = ["id", "item", "size", "qty", "unit"] as const;

export const ESTIMATE_FIELDS = [
  "id",
  "projectId",
  "title",
  "scope",
  "materials",
  "crewSize",
  "duration",
  "durationUnit",
  "notes",
  "neededBy",
  "neededByConfirmation",
  "isSample",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "syncState",
  "rev",
] as const;

const BANNED_PRICING_KEYS = [
  "price",
  "unitPrice",
  "cost",
  "laborRate",
  "rate",
  "total",
  "amount",
  "usd",
] as const;

export function assertNoPricingFields(value: Estimate | MaterialLine): void {
  for (const key of Object.keys(value)) {
    if ((BANNED_PRICING_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Pricing field "${key}" is not part of a Wire Chief estimate.`);
    }
  }
  if ("materials" in value) {
    for (const line of value.materials) assertNoPricingFields(line);
  }
}

export function crewTime(input: {
  crewSize: number;
  duration: number;
  durationUnit: DurationUnit;
}): { total: number; unit: string; label: string } {
  const crewSize = Number.isFinite(input.crewSize) ? input.crewSize : 0;
  const duration = Number.isFinite(input.duration) ? input.duration : 0;
  const total = roundQty(crewSize * duration);
  const unit = input.durationUnit === "days" ? "crew-days" : "crew-hours";
  const durationLabel = input.durationUnit === "days" ? "days" : "hours";
  return {
    total,
    unit,
    label: `${crewSize} electricians × ${duration} ${durationLabel} = ${total} ${unit}`,
  };
}

export function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

export function materialSummary(lines: MaterialLine[]): string {
  const filled = lines.filter((line) => line.item.trim());
  if (filled.length === 0) return "No material lines yet.";
  return `${filled.length} material line${filled.length === 1 ? "" : "s"}`;
}
