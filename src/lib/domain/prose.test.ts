import { displayTitle, foldProse, parseProse, richTokens, summarySplit } from "@/lib/domain/prose";
import { describe, expect, it } from "vitest";

const DENSE =
  "STATUS (2026-10-01): Rough-in started on the sample floor. Gear delivery is not confirmed [needs verification]. SCOPE ON RECORD: Replace one sample panel. Pull new sample feeders to the first floor. KEY FACTS: This is a made-up job. No street address. DEMARCATION: The sample utility stops at the pole. Our work starts at the weatherhead. NOTES: Call the sample superintendent before any digging.";

describe("structured job text", () => {
  it("splits a run-on description on all-caps labels", () => {
    const sections = parseProse(DENSE);
    expect(sections.map((section) => section.title)).toEqual([
      "STATUS (2026-10-01)",
      "SCOPE ON RECORD",
      "KEY FACTS",
      "DEMARCATION",
      "NOTES",
    ]);
    expect(sections[0]?.parts[0]).toMatchObject({ type: "list" });
    expect(sections[0]?.parts[0]?.items?.[1]).toContain("[needs verification]");
    expect(sections[1]?.parts[0]?.items).toEqual([
      "Replace one sample panel.",
      "Pull new sample feeders to the first floor.",
    ]);
    const { shown, hidden } = summarySplit(sections);
    expect(shown.map((section) => section.title)).toEqual(["STATUS (2026-10-01)", "SCOPE ON RECORD"]);
    expect(hidden.map((section) => section.title)).toEqual(["KEY FACTS", "DEMARCATION", "NOTES"]);
    expect(displayTitle("SCOPE ON RECORD")).toBe("Scope On Record");
    expect(displayTitle("STATUS (2026-10-01)")).toBe("Status (2026-10-01)");
  });

  it("keeps line breaks and does not split a label that sits inside a sentence", () => {
    const sections = parseProse("Called the sample GC about STATUS: tomorrow.\n\nGear is on the sample truck.\nPanel is in the sample room.");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBeNull();
    expect(sections[0]?.parts[0]?.text).toContain("STATUS: tomorrow.");
    expect(sections[0]?.parts[1]).toMatchObject({
      type: "list",
      items: ["Gear is on the sample truck.", "Panel is in the sample room."],
    });
  });

  it("uses a heading line when the text already has line breaks", () => {
    const sections = parseProse("STATUS:\nRough-in started.\nGear is late [needs verification].\n\nNOTES:\nCall the sample superintendent.");
    expect(sections.map((section) => section.title)).toEqual(["STATUS", "NOTES"]);
    expect(sections[0]?.summary).toBe(true);
    expect(sections[0]?.parts[0]?.items).toEqual(["Rough-in started.", "Gear is late [needs verification]."]);
    expect(summarySplit(sections).hidden.map((section) => section.title)).toEqual(["NOTES"]);
  });

  it("keeps a wrapped sentence together and leaves the line break in place", () => {
    const sections = parseProse("The sample loop needs new\npedestals along the road.");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.parts).toEqual([
      { type: "paragraph", text: "The sample loop needs new\npedestals along the road." },
    ]);
  });

  it("turns marked lines into a list and leaves a bare url in the paragraph", () => {
    const sections = parseProse("- Sample pedestal\n- Sample light\n\nhttps://drive.google.com/drive/folders/sample-not-a-real-folder.");
    expect(sections[0]?.parts[0]).toEqual({ type: "list", items: ["Sample pedestal", "Sample light"] });
    expect(sections[0]?.parts[1]).toEqual({
      type: "paragraph",
      text: "https://drive.google.com/drive/folders/sample-not-a-real-folder.",
    });
  });

  it("makes an http link tappable and keeps the trailing punctuation out of the href", () => {
    expect(richTokens("Drawings: https://drive.google.com/drive/folders/sample-folder. [needs verification]")).toEqual([
      { kind: "text", value: "Drawings: " },
      {
        kind: "link",
        value: "https://drive.google.com/drive/folders/sample-folder",
        href: "https://drive.google.com/drive/folders/sample-folder",
      },
      { kind: "text", value: "." },
      { kind: "text", value: " " },
      { kind: "verify", value: "[needs verification]" },
    ]);
  });

  it("folds a long unlabeled description and still shows status plus scope when those labels exist", () => {
    const lines = Array.from({ length: 8 }, (_, index) => `Sample note ${index} stays on this made-up job and should stay readable.`);
    const folded = foldProse(parseProse(lines.join("\n")));
    expect(folded.shown[0]?.parts[0]?.items).toHaveLength(3);
    expect(folded.hidden[0]?.parts[0]?.items).toHaveLength(5);

    const labeled = foldProse(parseProse(DENSE));
    expect(labeled.shown.map((section) => section.title)).toEqual(["STATUS (2026-10-01)", "SCOPE ON RECORD"]);
    expect(labeled.hidden.map((section) => section.title)).toEqual(["KEY FACTS", "DEMARCATION", "NOTES"]);
  });
});
