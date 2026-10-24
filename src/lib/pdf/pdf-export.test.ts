import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildDailyReportPdf } from "@/lib/pdf/daily-report-pdf";
import { buildEstimatePdf } from "@/lib/pdf/estimate-pdf";
import { textPdf } from "@/lib/data/sample-pdf";
import { describe, expect, it } from "vitest";

function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const latin = raw.toString("latin1");
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < latin.length) {
    const marker = latin.indexOf("stream", cursor);
    if (marker < 0) break;
    let dataStart = marker + "stream".length;
    if (latin[dataStart] === "\r") dataStart += 1;
    if (latin[dataStart] === "\n") dataStart += 1;
    const end = latin.indexOf("endstream", dataStart);
    if (end < 0) break;
    const slice = raw.subarray(dataStart, end);
    try {
      parts.push(inflateSync(slice).toString("latin1"));
    } catch {
      parts.push(slice.toString("latin1"));
    }
    cursor = end + "endstream".length;
  }
  return parts
    .join("\n")
    .replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex: string) => {
      const compact = hex.replace(/\s+/g, "");
      let out = "";
      for (let index = 0; index + 1 < compact.length; index += 2) {
        out += String.fromCharCode(Number.parseInt(compact.slice(index, index + 2), 16));
      }
      return out;
    });
}

const report = {
  company: "AKA Electric",
  preparedBy: "Mat Hiner, Project Manager",
  foremanName: "",
  projectName: "Findley State Park",
  jobNumber: "26194",
  gc: "Needs verification",
  location: "Findley State Park",
  isSample: true,
  date: "2026-10-23",
  dateConfirmation: "tentative" as const,
  weatherText: "",
  weatherEntered: false,
  manpower: [],
  completed: "",
  ongoing: "",
  planned: "",
  needsVerification: "Pedestal, panel, and stub scope needs verification.",
  punchItems: "",
  inspections: "",
  materials: "",
  blockers: "",
  decisions: "",
  tomorrowOutlook: "",
  dictatedNotes: "",
};

describe("PDF export", () => {
  it("builds a daily report PDF and marks blank weather unverified", async () => {
    const bytes = await buildDailyReportPdf(report);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
    expect(doc.getSubject()).toBe("Weather unverified");
    expect(doc.getKeywords()).toContain("weather-unverified");
    expect(doc.getTitle()).toContain("Findley State Park");
    const text = pdfText(bytes);
    expect(text).toContain("Prepared by Mat Hiner, Project Manager");
    expect(text).toContain("Foreman: Needs verification");
  });

  it("builds an estimate PDF with no pricing", async () => {
    const bytes = await buildEstimatePdf({
      company: "AKA Electric",
      preparedBy: "Mat Hiner, Project Manager",
      foremanName: "",
      projectName: "Findley State Park",
      jobNumber: "26194",
      gc: "Needs verification",
      location: "Findley State Park",
      isSample: true,
      title: "Wire pull — quantities not taken off",
      scope: "AKA pulls wire in conduit bored by others. 119 pads. No priced takeoff.",
      materials: [],
      crewSize: 0,
      duration: 0,
      durationUnit: "days",
      notes: "Crew size and duration need verification. No prices.",
      neededBy: null,
      neededByConfirmation: "tentative",
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getSubject()).toBe("Quantities only. No pricing.");
    expect(doc.getKeywords()).toContain("no-pricing");
    const text = pdfText(bytes);
    expect(text).toContain("Prepared by Mat Hiner, Project Manager");
    expect(text).toContain("Foreman: Needs verification");
  });

  it("writes a Drive note PDF that a viewer can open", async () => {
    const blob = textPdf("Findley State Park - Drive notes 10/23/26", ["119 pads", "Job 26194"]);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
  });
});
