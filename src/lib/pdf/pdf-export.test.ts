import { PDFDocument } from "pdf-lib";
import { buildDailyReportPdf } from "@/lib/pdf/daily-report-pdf";
import { buildEstimatePdf } from "@/lib/pdf/estimate-pdf";
import { textPdf } from "@/lib/data/sample-pdf";
import { describe, expect, it } from "vitest";

const report = {
  company: "AKA Electric",
  preparedBy: "Mat Hiner",
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
  });

  it("builds an estimate PDF with no pricing", async () => {
    const bytes = await buildEstimatePdf({
      company: "AKA Electric",
      preparedBy: "Mat Hiner",
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
  });

  it("writes a Drive note PDF that a viewer can open", async () => {
    const blob = textPdf("Findley State Park - Drive notes 10/23/26", ["119 pads", "Job 26194"]);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
  });
});
