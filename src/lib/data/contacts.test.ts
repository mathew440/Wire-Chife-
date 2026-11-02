import { db } from "@/lib/data/db";
import { blankContact, blankProject } from "@/lib/data/factories";
import { getProject, listProjects, saveProject } from "@/lib/data/repo";
import { resetSeedGate } from "@/lib/data/seed";
import { groupContactsByJob, removeProjectContact, upsertProjectContact } from "@/lib/domain/contact-groups";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  resetSeedGate();
  await db.delete();
  await db.open();
});

describe("job contacts stay on the project row", () => {
  it("saves a contact on one job and leaves the other job alone", async () => {
    const jobA = await saveProject(blankProject({ name: "Sample Job A", jobNumber: "1001" }));
    const jobB = await saveProject(
      blankProject({
        name: "Sample Job B",
        jobNumber: "1002",
        contacts: [blankContact({ id: "c-pat", name: "Pat Sample", company: "Sample Design Co", role: "Architect", email: "pat@example.com" })],
      }),
    );

    const added = blankContact({
      id: "c-sam",
      name: "Sam Sample",
      company: "Sample Owners LLC",
      role: "Owner",
      phone: "555-0100",
      email: "sam@example.com",
    });
    await saveProject({ ...jobA, contacts: upsertProjectContact(jobA.contacts, added) });

    const storedA = await getProject(jobA.id);
    const storedB = await getProject(jobB.id);
    expect(storedA?.contacts).toEqual([added]);
    expect(storedA?.contacts[0]).not.toHaveProperty("projectId");
    expect(storedB?.contacts.map((contact) => contact.id)).toEqual(["c-pat"]);

    const groups = groupContactsByJob(await listProjects());
    expect(groups.find((group) => group.id === jobA.id)?.contacts.map((contact) => contact.name)).toEqual(["Sam Sample"]);
    expect(groups.find((group) => group.id === jobB.id)?.contacts.map((contact) => contact.name)).toEqual(["Pat Sample"]);

    await saveProject({
      ...storedA!,
      contacts: upsertProjectContact(storedA!.contacts, { ...storedA!.contacts[0]!, phone: "555-0101" }),
    });
    const edited = await getProject(jobA.id);
    expect(edited?.contacts[0]).toMatchObject({ id: "c-sam", phone: "555-0101", email: "sam@example.com" });
    expect(Object.keys(edited!.contacts[0]!).sort()).toEqual(["company", "email", "id", "name", "phone", "role"]);

    await saveProject({ ...edited!, contacts: removeProjectContact(edited!.contacts, "c-sam") });
    expect((await getProject(jobA.id))?.contacts).toEqual([]);
    expect((await getProject(jobB.id))?.contacts).toHaveLength(1);
  });
});
