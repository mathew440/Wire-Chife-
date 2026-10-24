import { blankEstimate, blankMaterialLine } from "@/lib/data/factories";
import { ESTIMATE_FIELDS, MATERIAL_LINE_FIELDS, assertNoPricingFields, crewTime } from "@/lib/domain/estimates";
import { describe, expect, it } from "vitest";

describe("estimates", () => {
  it("has no pricing fields and states labor as crew size times duration", () => {
    const estimate = blankEstimate("job-a", {
      materials: [blankMaterialLine({ item: "EMT", size: "3/4", qty: 10, unit: "ft" })],
      crewSize: 4,
      duration: 6,
      durationUnit: "days",
    });
    expect(Object.keys(estimate).sort()).toEqual([...ESTIMATE_FIELDS].sort());
    expect(Object.keys(estimate.materials[0]).sort()).toEqual([...MATERIAL_LINE_FIELDS].sort());
    expect(() => assertNoPricingFields(estimate)).not.toThrow();
    expect(crewTime(estimate).label).toBe("4 electricians × 6 days = 24 crew-days");
    expect(JSON.stringify(estimate)).not.toMatch(/price|unitPrice|laborRate|\$/i);
  });
});
