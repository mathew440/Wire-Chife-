import { foremanDisplay } from "@/lib/data/roles";
import { confirmationLabel, formatDay } from "@/lib/domain/dates";
import { logStatusLabel } from "@/lib/domain/logs";
import type { Confirmation, LogItem, Task } from "@/lib/data/types";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { slug } from "@/lib/pdf/daily-report-pdf";

export interface WeeklyReportSlice {
  date: string;
  dateConfirmation: Confirmation;
  weatherText: string;
  weatherEntered: boolean;
  completed: string;
  ongoing: string;
  planned: string;
  needsVerification: string;
  blockers: string;
}

export interface WeeklySummaryPdfInput {
  company: string;
  preparedBy: string;
  foremanName: string;
  projectName: string;
  jobNumber: string;
  isSample: boolean;
  weekEnding: string;
  weekStart: string;
  reports: WeeklyReportSlice[];
  openItems: Pick<Task, "title" | "owner" | "dueDate" | "status" | "evidence">[];
  openLogs: Pick<LogItem, "kind" | "number" | "description" | "status" | "dueDate" | "ballInCourt">[];
}

const NAVY = rgb(0.05, 0.08, 0.13);
const TEAL = rgb(0.1, 0.42, 0.38);
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.32, 0.37, 0.44);
const PAPER = rgb(1, 1, 1);
const ORANGE = rgb(0.72, 0.36, 0.12);

export async function buildWeeklySummaryPdf(input: WeeklySummaryPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const sheet = new Sheet(doc, page, font, bold);
  sheet.banner(input);
  sheet.line(input.projectName, 16, bold, INK);
  sheet.line(
    [input.jobNumber ? `Job ${input.jobNumber}` : "No job number", `Week ${input.weekStart} to ${input.weekEnding}`].join("   ·   "),
    9,
    font,
    MUTED,
  );
  sheet.line(`Prepared by ${input.preparedBy}  ·  ${input.company}`, 9, font, MUTED);
  sheet.line(`Foreman: ${foremanDisplay(input.foremanName)}`, 9, font, input.foremanName.trim() ? INK : ORANGE);
  sheet.gap(10);
  sheet.line("Daily log", 12, bold, TEAL);
  if (input.reports.length === 0) {
    sheet.line("No daily report is saved in this week.", 9, font, MUTED);
  } else {
    const reports = [...input.reports].sort((a, b) => a.date.localeCompare(b.date));
    for (const report of reports) {
      sheet.gap(6);
      sheet.line(`${formatDay(report.date, input.weekEnding)}  ·  ${confirmationLabel(report.dateConfirmation)}`, 10, bold, INK);
      sheet.line(report.weatherEntered ? `Weather: ${report.weatherText}` : "Weather: not entered", 9, font, report.weatherEntered ? INK : MUTED);
      sheet.line(`Completed: ${textOrBlank(report.completed)}`, 9, font, INK);
      sheet.line(`Ongoing: ${textOrBlank(report.ongoing)}`, 9, font, INK);
      sheet.line(`Planned: ${textOrBlank(report.planned)}`, 9, font, INK);
      sheet.line(`Needs verification: ${textOrBlank(report.needsVerification)}`, 9, font, INK);
      sheet.line(`Blockers: ${textOrBlank(report.blockers)}`, 9, font, INK);
    }
  }
  sheet.gap(12);
  sheet.line("Open items", 12, bold, TEAL);
  if (input.openItems.length === 0) {
    sheet.line("No open items on this job.", 9, font, MUTED);
  } else {
    for (const item of input.openItems) {
      const due = item.dueDate ? formatDay(item.dueDate, input.weekEnding) : "No due date";
      sheet.line(`${item.title}  ·  ${item.owner || "No owner"}  ·  ${due}`, 9, font, INK);
      if (item.evidence.trim()) sheet.line(`Source: ${item.evidence.trim()}`, 8, font, MUTED);
    }
  }
  sheet.gap(12);
  sheet.line("Open submittals and RFIs", 12, bold, TEAL);
  if (input.openLogs.length === 0) {
    sheet.line("No open submittals or RFIs on this job.", 9, font, MUTED);
  } else {
    for (const item of input.openLogs) {
      const name = item.kind === "rfi" ? "RFI" : "Submittal";
      const title = [item.number, item.description].filter(Boolean).join(" · ") || "No description";
      const due = item.dueDate ? formatDay(item.dueDate, input.weekEnding) : "No due date";
      sheet.line(`${name} ${title}  ·  ${logStatusLabel(item.status)}  ·  ${item.ballInCourt || "No ball in court"}  ·  ${due}`, 9, font, INK);
    }
  }
  sheet.finish(input.isSample);
  doc.setTitle(`${input.projectName} weekly summary ${input.weekEnding}`);
  doc.setAuthor(input.preparedBy);
  doc.setCreator("Wire Chief");
  return doc.save();
}

export function weeklyPdfFileName(projectName: string, weekEnding: string): string {
  return `WireChief-Week-${slug(projectName)}-${weekEnding}.pdf`;
}

function textOrBlank(value: string): string {
  return value.trim() || "—";
}

class Sheet {
  private y: number;

  constructor(
    private doc: PDFDocument,
    private page: PDFPage,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.y = 716;
  }

  banner(input: WeeklySummaryPdfInput) {
    this.page.drawRectangle({ x: 0, y: 736, width: 612, height: 56, color: NAVY });
    this.page.drawRectangle({ x: 0, y: 732, width: 612, height: 4, color: rgb(0.24, 0.78, 0.7) });
    this.page.drawText("WIRE CHIEF", { x: 32, y: 764, size: 14, font: this.bold, color: PAPER });
    this.page.drawText("WEEKLY SUMMARY", { x: 32, y: 746, size: 10, font: this.font, color: rgb(0.7, 0.9, 0.86) });
    if (input.isSample) {
      this.page.drawText("SAMPLE", { x: 520, y: 746, size: 9, font: this.bold, color: rgb(0.95, 0.62, 0.32) });
    }
  }

  line(text: string, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
    const lines = wrap(text, font, size, 548);
    for (const row of lines) {
      this.ensure(size + 4);
      this.page.drawText(row || " ", { x: 32, y: this.y - size, size, font, color });
      this.y -= size + 3;
    }
  }

  gap(amount: number) {
    this.y -= amount;
  }

  private ensure(height: number) {
    if (this.y - height >= 48) return;
    this.page = this.doc.addPage([612, 792]);
    this.page.drawRectangle({ x: 0, y: 764, width: 612, height: 28, color: NAVY });
    this.page.drawText("WIRE CHIEF  ·  WEEKLY SUMMARY", { x: 32, y: 774, size: 10, font: this.bold, color: PAPER });
    this.y = 748;
  }

  finish(isSample: boolean) {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(
        `Wire Chief local record  ·  page ${index + 1} of ${pages.length}${isSample ? "  ·  SAMPLE" : ""}`,
        { x: 32, y: 28, size: 8, font: this.font, color: MUTED },
      );
    });
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const source = text.replace(/\r/g, "");
  const lines: string[] = [];
  for (const paragraph of source.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}
