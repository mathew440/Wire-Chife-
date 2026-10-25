import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildDailyReportPdf } from "@/lib/pdf/daily-report-pdf";
import { buildEstimatePdf } from "@/lib/pdf/estimate-pdf";
import { buildWeeklySummaryPdf } from "@/lib/pdf/weekly-summary-pdf";
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
  company: "AKA Electric Inc",
  preparedBy: "Mat Hiner, Project Manager",
  email: "Mathew@akaelectricinc.com",
  foremanName: "",
  projectName: "Sample Job A",
  jobNumber: "1001",
  gc: "Needs verification",
  location: "Sample site",
  isSample: true,
  date: "2026-10-23",
  dateConfirmation: "tentative" as const,
  weatherText: "",
  weatherEntered: false,
  manpower: [],
  completed: "",
  ongoing: "",
  planned: "",
  needsVerification: "Scope needs verification.",
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
    expect(doc.getTitle()).toContain("Sample Job A");
    const text = pdfText(bytes);
    expect(text).toContain("Prepared by Mat Hiner, Project Manager");
    expect(text).toContain("Foreman: Needs verification");
  });

  it("builds an estimate PDF with no pricing", async () => {
    const bytes = await buildEstimatePdf({
      company: "AKA Electric Inc",
      preparedBy: "Mat Hiner, Project Manager",
      email: "Mathew@akaelectricinc.com",
      foremanName: "",
      projectName: "Sample Job A",
      jobNumber: "1001",
      gc: "Needs verification",
      location: "Sample site",
      isSample: true,
      title: "Wire pull — quantities not taken off",
      scope: "Sample scope. No priced takeoff.",
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

  it("builds a weekly summary from saved reports and open items", async () => {
    const bytes = await buildWeeklySummaryPdf({
      company: "AKA Electric Inc",
      preparedBy: "Mat Hiner, Project Manager",
      email: "Mathew@akaelectricinc.com",
      foremanName: "",
      projectName: "Sample Job A",
      jobNumber: "1001",
      isSample: true,
      weekEnding: "2026-10-24",
      weekStart: "2026-10-18",
      reports: [
        {
          date: "2026-10-23",
          dateConfirmation: "tentative",
          weatherText: "",
          weatherEntered: false,
          completed: "Pulled feeder",
          ongoing: "",
          planned: "",
          needsVerification: "",
          blockers: "",
        },
      ],
      openItems: [{ title: "Confirm panel", owner: "GC", dueDate: "2026-10-25", status: "open", evidence: "Drawing note" }],
      openLogs: [
        {
          kind: "submittal",
          number: "S-1",
          description: "Panel schedule",
          status: "submitted",
          dueDate: "2026-10-28",
          ballInCourt: "GC",
        },
      ],
      orders: [
        {
          description: "Panel",
          vendor: "Sample Supply",
          quantity: "2",
          status: "shipped",
          expectedDate: "2026-10-20",
          late: true,
        },
      ],
      hours: {
        allowed: 40,
        used: 18,
        remaining: 22,
        percent: 45,
        burnPerWeek: 42,
        fromTimeEntries: 12,
        fromReports: 6,
      },
    });
    const text = pdfText(bytes);
    expect(text).toContain("WEEKLY SUMMARY");
    expect(text).toContain("Prepared by Mat Hiner, Project Manager, AKA Electric Inc, Mathew@akaelectricinc.com");
    expect(text).toContain("Pulled feeder");
    expect(text).toContain("Confirm panel");
    expect(text).toContain("S-1");
    expect(text).toContain("Weather: not entered");
    expect(text).toContain("Panel");
    expect(text).toContain("LATE");
    expect(text).toContain("Hours allowed: 40");
    expect(text).toContain("Hours used: 18");
    expect(text).toContain("Hours per week: 42");
    expect(text).toContain("Typed hours are used first");
  });

  it("writes a note PDF that a viewer can open", async () => {
    const blob = textPdf("Sample Job A notes", ["Sample scope", "Job 1001"]);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
  });
});
