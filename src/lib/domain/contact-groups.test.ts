import { blankContact } from "@/lib/data/factories";
import type { Contact } from "@/lib/data/types";
import {
  GENERAL_CONTACT_GROUP_ID,
  GENERAL_CONTACT_GROUP_NAME,
  contactCountLabel,
  contactHasDetails,
  groupContactsByJob,
  removeProjectContact,
  upsertProjectContact,
} from "@/lib/domain/contact-groups";
import { describe, expect, it } from "vitest";

const sam = blankContact({
  id: "c-sam",
  name: "Sam Sample",
  role: "Owner",
  phone: "555-0100",
  email: "sam@example.com",
  company: "Sample Owners LLC",
});

const pat = blankContact({
  id: "c-pat",
  name: "Pat Sample",
  role: "Architect",
  phone: "",
  email: "pat@example.com",
  company: "Sample Design Co",
});

describe("contacts grouped by job", () => {
  it("lists every job with a count and keeps each contact on its job", () => {
    const groups = groupContactsByJob([
      { id: "job-b", name: "Sample Job B", jobNumber: "1002", contacts: [pat] },
      { id: "job-a", name: "Sample Job A", jobNumber: "1001", contacts: [sam, blankContact({ id: "blank" })] },
      { id: "job-c", name: "Sample Job C", jobNumber: "", contacts: [] },
    ]);

    expect(groups.map((group) => [group.name, group.contacts.length])).toEqual([
      ["Sample Job A", 1],
      ["Sample Job B", 1],
      ["Sample Job C", 0],
    ]);
    expect(groups[0]?.contacts[0]).toBe(sam);
    expect(groups[1]?.contacts[0]).toBe(pat);
    expect(groups.some((group) => group.id === GENERAL_CONTACT_GROUP_ID)).toBe(false);
  });

  it("puts contacts with no job in No job / General and does not drop them", () => {
    const loose = blankContact({ id: "c-loose", name: "Casey Sample", phone: "555-0199", company: "Sample Supply" });
    const groups = groupContactsByJob(
      [
        { id: "job-a", name: "Sample Job A", jobNumber: "1001", contacts: [sam] },
        { id: "  ", name: "", jobNumber: "", contacts: [loose, blankContact()] },
      ],
      { showEmptyGeneral: true },
    );

    expect(groups.map((group) => group.id)).toEqual(["job-a", GENERAL_CONTACT_GROUP_ID]);
    const general = groups[1];
    expect(general?.name).toBe(GENERAL_CONTACT_GROUP_NAME);
    expect(general?.contacts).toEqual([loose]);
    expect(contactCountLabel(general?.contacts.length ?? 0)).toBe("1 contact");
  });

  it("can show an empty general group without inventing a contact", () => {
    const groups = groupContactsByJob([{ id: "job-a", name: "Sample Job A", jobNumber: "", contacts: [] }], {
      showEmptyGeneral: true,
    });
    expect(groups[1]).toMatchObject({ id: GENERAL_CONTACT_GROUP_ID, contacts: [] });
    expect(contactCountLabel(0)).toBe("0 contacts");
  });

  it("names a job that has no name and ignores a contact with no details", () => {
    expect(contactHasDetails(blankContact())).toBe(false);
    const groups = groupContactsByJob([{ id: "job-z", name: "  ", jobNumber: "  ", contacts: [blankContact({ name: "   " })] }]);
    expect(groups[0]).toMatchObject({ name: "Untitled job", jobNumber: "", contacts: [] });
  });

  it("adds and edits a contact without rewriting the others or adding a project field", () => {
    const stored = { ...sam, legacyNote: "keep me" } as Contact & { legacyNote: string };
    const added = upsertProjectContact([stored], pat);
    expect(added.map((item) => item.id)).toEqual(["c-sam", "c-pat"]);
    expect(added[0]).toBe(stored);

    const edited = upsertProjectContact(added, { ...pat, phone: "555-0102" });
    expect(edited[0]).toMatchObject({ name: "Sam Sample", legacyNote: "keep me" });
    expect(edited[1]).toMatchObject({ id: "c-pat", phone: "555-0102", email: "pat@example.com" });
    expect(edited[1]).not.toHaveProperty("projectId");
    expect(removeProjectContact(edited, "c-pat")).toEqual([stored]);
  });

  it("refuses a contact that is only blank fields", () => {
    expect(() => upsertProjectContact([], blankContact({ id: "empty" }))).toThrow(/name, company, role, phone, or email/);
  });
});
