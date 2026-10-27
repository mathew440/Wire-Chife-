import { mapsUrl, presentContact } from "@/lib/domain/contact-card";
import { describe, expect, it } from "vitest";

describe("contact card lines", () => {
  it("pulls a parenthetical address and a trailing note out of the role", () => {
    const view = presentContact({
      name: "Sam Sample",
      company: "Sample Owners LLC",
      role: "Owner (100 Sample Street, Bldg E, Sample City, OH 00000) - per sample note 2",
      phone: "555-0199",
      email: "",
    });
    expect(view.company).toBe("Sample Owners LLC");
    expect(view.role).toBe("Owner");
    expect(view.address).toBe("100 Sample Street, Bldg E, Sample City, OH 00000");
    expect(view.note).toBe("per sample note 2");
    expect(view.email).toBe("");
    expect(mapsUrl(view.address)).toContain("100%20Sample%20Street");
  });

  it("reads company and address after a dash, and a verify note in parentheses", () => {
    const view = presentContact({
      name: "Pat Sample",
      company: "",
      role: "Architect - Sample Design Co, 200 Example Avenue, Suite 1, Sample City, OH 00001 (per sample sheet - verify current)",
      phone: "",
      email: "pat@example.com",
    });
    expect(view.role).toBe("Architect");
    expect(view.company).toBe("Sample Design Co");
    expect(view.address).toBe("200 Example Avenue, Suite 1, Sample City, OH 00001");
    expect(view.note).toBe("per sample sheet - verify current");
  });

  it("keeps the company field when the role also names a company", () => {
    const view = presentContact({
      name: "Pat Sample",
      company: "Sample Design Co",
      role: "Architect",
      phone: "555-0100",
      email: "pat@example.com",
    });
    expect(view.company).toBe("Sample Design Co");
    expect(view.role).toBe("Architect");
    expect(view.address).toBe("");
    expect(view.note).toBe("");
  });

  it("shows the company field and a different company named in the role", () => {
    const view = presentContact({
      name: "Pat Sample",
      company: "Sample Holding Co",
      role: "Architect - Sample Design Co, 200 Example Avenue, Sample City, OH 00001",
      phone: "",
      email: "",
    });
    expect(view.company).toBe("Sample Holding Co");
    expect(view.roleCompany).toBe("Sample Design Co");
    expect(view.role).toBe("Architect");
  });
});
