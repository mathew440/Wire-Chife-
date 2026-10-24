import { foremanDisplay } from "@/lib/data/roles";
import { confirmationLabel } from "@/lib/domain/dates";
import { weatherLabel } from "@/lib/domain/reports";
import type { Confirmation } from "@/lib/data/types";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface DailyReportPdfInput {
  company: string;
  preparedBy: string;
  /** Blank when the foreman still needs verification. */
  foremanName: string;
  projectName: string;
  jobNumber: string;
  gc: string;
  location: string;
  isSample: boolean;
  date: string;
  dateConfirmation: Confirmation;
  weatherText: string;
  weatherEntered: boolean;
  manpower: { name: string; hours: number | null; area: string }[];
  completed: string;
  ongoing: string;
  planned: string;
  needsVerification: string;
  punchItems: string;
  inspections: string;
  materials: string;
  blockers: string;
  decisions: string;
  tomorrowOutlook: string;
  dictatedNotes: string;
}

const NAVY = rgb(0.05, 0.08, 0.13);
const TEAL = rgb(0.1, 0.42, 0.38);
const ORANGE = rgb(0.72, 0.36, 0.12);
const AMBER = rgb(0.55, 0.4, 0.05);
const BLUE = rgb(0.15, 0.32, 0.55);
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.32, 0.37, 0.44);
const PAPER = rgb(1, 1, 1);
const WASH = rgb(0.95, 0.96, 0.97);

export async function buildDailyReportPdf(input: DailyReportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const weather = weatherLabel(input);
  const sheet = new Sheet(doc, font, bold);
  sheet.banner(input, weather.text);

  sheet.heading(input.projectName, 16);
  sheet.paragraph(
    [input.jobNumber ? `Job ${input.jobNumber}` : "No job number", input.gc || "No GC", input.location || "No location"].join(
      "   ·   ",
    ),
    9,
    MUTED,
  );
  sheet.paragraph(`Prepared by ${input.preparedBy}  ·  ${input.company}`, 9, MUTED);
  sheet.paragraph(`Foreman: ${foremanDisplay(input.foremanName)}`, 9, input.foremanName.trim() ? INK : ORANGE);
  sheet.gap(8);
  sheet.paragraph(weather.entered ? `Weather: ${weather.text}  ·  entered on this report` : `Weather: ${weather.text}`, 10, weather.entered ? INK : ORANGE, bold);
  sheet.gap(6);
  sheet.paragraph("Manpower", 10, TEAL, bold);
  if (input.manpower.length === 0) {
    sheet.paragraph("No names on this report.", 9, MUTED);
  } else {
    for (const person of input.manpower) {
      const hours = person.hours == null ? "hours not entered" : `${person.hours}h`;
      sheet.paragraph(`${person.name}  ·  ${person.area || "area not set"}  ·  ${hours}`, 9, INK);
    }
  }
  sheet.gap(8);

  const sections: Array<[string, string, ReturnType<typeof rgb>]> = [
    ["COMPLETED", input.completed, TEAL],
    ["ONGOING", input.ongoing, BLUE],
    ["PLANNED", input.planned, ORANGE],
    ["NEEDS VERIFICATION", input.needsVerification, AMBER],
  ];
  sheet.sectionGrid(sections);
  sheet.gap(8);

  const notes: Array<[string, string]> = [
    ["Punch items", input.punchItems],
    ["Inspections", input.inspections],
    ["Materials", input.materials],
    ["Blockers", input.blockers],
    ["Decisions", input.decisions],
    ["Tomorrow's outlook", input.tomorrowOutlook],
  ];
  for (const [label, text] of notes) {
    sheet.note(label, text);
  }
  if (input.dictatedNotes.trim()) {
    sheet.gap(4);
    sheet.note("Dictated notes (source — not a status)", input.dictatedNotes);
  }

  sheet.finish(input.isSample);
  doc.setTitle(`${input.projectName} daily report ${input.date}`);
  doc.setAuthor(input.preparedBy);
  doc.setCreator("Wire Chief");
  doc.setSubject(weather.entered ? "Weather entered" : "Weather unverified");
  doc.setKeywords([
    "wire-chief",
    "daily-report",
    weather.entered ? "weather-entered" : "weather-unverified",
    input.dateConfirmation,
  ]);
  return doc.save();
}

class Sheet {
  page: PDFPage;
  y = 760;
  pageNumber = 1;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = doc.addPage([612, 792]);
  }

  banner(input: DailyReportPdfInput, weather: string) {
    this.page.drawRectangle({ x: 0, y: 736, width: 612, height: 56, color: NAVY });
    this.page.drawRectangle({ x: 0, y: 732, width: 612, height: 4, color: rgb(0.24, 0.78, 0.7) });
    this.page.drawText("WIRE CHIEF", { x: 32, y: 764, size: 14, font: this.bold, color: PAPER });
    this.page.drawText("DAILY REPORT", { x: 32, y: 746, size: 10, font: this.font, color: rgb(0.7, 0.9, 0.86) });
    const flag = confirmationLabel(input.dateConfirmation);
    const right = `${input.date}  ·  ${flag}`;
    const width = this.bold.widthOfTextAtSize(right, 11);
    this.page.drawText(right, { x: 580 - width, y: 758, size: 11, font: this.bold, color: PAPER });
    if (input.isSample) {
      const sample = "DRIVE AS OF 10/23/26";
      const sampleWidth = this.bold.widthOfTextAtSize(sample, 9);
      this.page.drawText(sample, { x: 580 - sampleWidth, y: 744, size: 9, font: this.bold, color: rgb(0.95, 0.62, 0.32) });
    }
    this.y = 716;
    void weather;
  }

  heading(text: string, size: number) {
    this.ensure(size + 6);
    this.page.drawText(text, { x: 32, y: this.y - size, size, font: this.bold, color: INK });
    this.y -= size + 4;
  }

  paragraph(text: string, size: number, color: ReturnType<typeof rgb>, font = this.font) {
    const lines = wrap(text, font, size, 548);
    for (const line of lines) {
      this.ensure(size + 3);
      this.page.drawText(line || " ", { x: 32, y: this.y - size, size, font, color });
      this.y -= size + 3;
    }
  }

  gap(amount: number) {
    this.y -= amount;
  }

  sectionGrid(sections: Array<[string, string, ReturnType<typeof rgb>]>) {
    const colWidth = 266;
    const measured = sections.map((section) => wrap(section[1], this.font, 8.5, colWidth - 16));
    if (measured.some((lines) => lines.length > 12)) {
      for (const section of sections) this.note(section[0], section[1]);
      return;
    }
    const pairs = [
      [sections[0], sections[1], measured[0], measured[1]],
      [sections[2], sections[3], measured[2], measured[3]],
    ] as const;
    for (const pair of pairs) {
      const leftLines = pair[2];
      const rightLines = pair[3];
      const rows = Math.max(leftLines.length, rightLines.length, 1);
      const height = 18 + rows * 11;
      this.ensure(height + 8);
      this.column(32, this.y - height, colWidth, height, pair[0][0], leftLines, pair[0][2]);
      this.column(314, this.y - height, colWidth, height, pair[1][0], rightLines, pair[1][2]);
      this.y -= height + 8;
    }
  }

  column(x: number, bottom: number, width: number, height: number, title: string, lines: string[], color: ReturnType<typeof rgb>) {
    this.page.drawRectangle({ x, y: bottom, width, height, color: WASH, borderColor: rgb(0.82, 0.85, 0.88), borderWidth: 0.6 });
    this.page.drawRectangle({ x, y: bottom + height - 3, width, height: 3, color });
    this.page.drawText(title, { x: x + 8, y: bottom + height - 16, size: 8, font: this.bold, color });
    lines.forEach((line, index) => {
      this.page.drawText(line || " ", { x: x + 8, y: bottom + height - 30 - index * 11, size: 8.5, font: this.font, color: INK });
    });
  }

  note(label: string, text: string) {
    this.ensure(22);
    this.page.drawText(label.toUpperCase(), { x: 32, y: this.y - 9, size: 8, font: this.bold, color: TEAL });
    this.y -= 12;
    this.paragraph(text.trim() || "—", 9, INK);
    this.y -= 4;
  }

  ensure(height: number) {
    if (this.y - height < 48) {
      this.page = this.doc.addPage([612, 792]);
      this.pageNumber += 1;
      this.page.drawRectangle({ x: 0, y: 764, width: 612, height: 28, color: NAVY });
      this.page.drawText("WIRE CHIEF  ·  DAILY REPORT", { x: 32, y: 774, size: 10, font: this.bold, color: PAPER });
      this.y = 748;
    }
  }

  finish(isSample: boolean) {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(
        `Wire Chief local record  ·  not a certified payroll  ·  page ${index + 1} of ${pages.length}${isSample ? "  ·  DRIVE AS OF 10/23/26" : ""}`,
        { x: 32, y: 28, size: 8, font: this.font, color: MUTED },
      );
    });
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const source = text.trim() ? text.replace(/\r/g, "") : "—";
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
  return lines.length ? lines : ["—"];
}

export function reportPdfFileName(projectName: string, date: string): string {
  return `WireChief-Daily-${slug(projectName)}-${date}.pdf`;
}

export function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 60) || "job";
}
