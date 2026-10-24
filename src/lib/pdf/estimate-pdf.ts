import { confirmationLabel, formatDay } from "@/lib/domain/dates";
import { crewTime } from "@/lib/domain/estimates";
import type { Confirmation, DurationUnit, MaterialLine } from "@/lib/data/types";
import { slug } from "@/lib/pdf/daily-report-pdf";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface EstimatePdfInput {
  company: string;
  preparedBy: string;
  projectName: string;
  jobNumber: string;
  gc: string;
  location: string;
  isSample: boolean;
  title: string;
  scope: string;
  materials: MaterialLine[];
  crewSize: number;
  duration: number;
  durationUnit: DurationUnit;
  notes: string;
  neededBy: string | null;
  neededByConfirmation: Confirmation;
}

const NAVY = rgb(0.05, 0.08, 0.13);
const ORANGE = rgb(0.72, 0.36, 0.12);
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.32, 0.37, 0.44);
const PAPER = rgb(1, 1, 1);
const WASH = rgb(0.97, 0.95, 0.92);
const RULE = rgb(0.82, 0.84, 0.88);

export async function buildEstimatePdf(input: EstimatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 736, width: 612, height: 56, color: NAVY });
  page.drawRectangle({ x: 0, y: 732, width: 612, height: 4, color: rgb(0.85, 0.48, 0.2) });
  page.drawText("WIRE CHIEF", { x: 32, y: 764, size: 14, font: bold, color: PAPER });
  page.drawText("MATERIAL AND LABOR TAKEOFF", { x: 32, y: 746, size: 10, font, color: rgb(0.98, 0.84, 0.7) });
  if (input.isSample) {
    const sample = "DRIVE AS OF 10/23/26";
    page.drawText(sample, { x: 580 - bold.widthOfTextAtSize(sample, 9), y: 750, size: 9, font: bold, color: rgb(0.95, 0.62, 0.32) });
  }

  let y = 710;
  y = draw(page, input.title || "Untitled takeoff", 32, y, 16, bold, INK);
  y = draw(
    page,
    [input.projectName, input.jobNumber ? `Job ${input.jobNumber}` : "", input.gc, input.location].filter(Boolean).join("   ·   "),
    32,
    y - 2,
    9,
    font,
    MUTED,
  );
  y = draw(page, `${input.preparedBy}  ·  ${input.company}`, 32, y, 9, font, MUTED);

  y -= 8;
  page.drawRectangle({ x: 32, y: y - 28, width: 548, height: 32, color: WASH });
  page.drawText("QUANTITIES ONLY  —  NO PRICING", { x: 42, y: y - 14, size: 11, font: bold, color: ORANGE });
  page.drawText("This sheet is not a quote and not a purchase order.", { x: 250, y: y - 14, size: 9, font, color: INK });
  y -= 44;

  y = draw(page, "SCOPE", 32, y, 8, bold, ORANGE);
  for (const line of wrap(input.scope.trim() || "—", font, 10, 548)) {
    y = draw(page, line, 32, y, 10, font, INK);
  }
  y -= 10;

  y = draw(page, "MATERIALS", 32, y, 8, bold, ORANGE);
  y -= 4;
  page.drawRectangle({ x: 32, y: y - 16, width: 548, height: 18, color: NAVY });
  page.drawText("ITEM", { x: 40, y: y - 12, size: 8, font: bold, color: PAPER });
  page.drawText("SIZE", { x: 320, y: y - 12, size: 8, font: bold, color: PAPER });
  page.drawText("QTY", { x: 450, y: y - 12, size: 8, font: bold, color: PAPER });
  page.drawText("UNIT", { x: 520, y: y - 12, size: 8, font: bold, color: PAPER });
  y -= 18;

  const lines = input.materials.filter((line) => line.item.trim() || line.qty);
  const shown = lines.length ? lines : [{ id: "empty", item: "—", size: "", qty: 0, unit: "" }];
  shown.forEach((line, index) => {
    if (index % 2 === 0) page.drawRectangle({ x: 32, y: y - 16, width: 548, height: 16, color: rgb(0.96, 0.97, 0.98) });
    page.drawText(trimTo(line.item || "—", font, 9, 270), { x: 40, y: y - 12, size: 9, font, color: INK });
    page.drawText(trimTo(line.size || "—", font, 9, 110), { x: 320, y: y - 12, size: 9, font, color: INK });
    page.drawText(String(line.qty), { x: 450, y: y - 12, size: 9, font, color: INK });
    page.drawText(line.unit || "—", { x: 520, y: y - 12, size: 9, font, color: INK });
    y -= 16;
  });

  y -= 16;
  const labor = crewTime(input);
  page.drawRectangle({ x: 32, y: y - 58, width: 548, height: 62, color: WASH, borderColor: RULE, borderWidth: 0.8 });
  page.drawText("LABOR", { x: 42, y: y - 16, size: 8, font: bold, color: ORANGE });
  page.drawText(labor.label, { x: 42, y: y - 34, size: 12, font: bold, color: INK });
  page.drawText("Crew size times duration. No dollar rate.", { x: 42, y: y - 50, size: 9, font, color: MUTED });
  y -= 76;

  if (input.neededBy) {
    y = draw(
      page,
      `Needed by ${formatDay(input.neededBy)}  ·  ${confirmationLabel(input.neededByConfirmation)}`,
      32,
      y,
      10,
      bold,
      INK,
    );
    y -= 6;
  }
  if (input.notes.trim()) {
    y = draw(page, "NOTES", 32, y, 8, bold, ORANGE);
    for (const line of wrap(input.notes, font, 9, 548)) y = draw(page, line, 32, y, 9, font, INK);
  }

  page.drawText(
    `Wire Chief takeoff  ·  quantities only, no pricing  ·  ${input.isSample ? "DRIVE AS OF 10/23/26  ·  " : ""}not a quote`,
    { x: 32, y: 28, size: 8, font, color: MUTED },
  );

  doc.setTitle(`${input.projectName} estimate ${input.title}`);
  doc.setAuthor(input.preparedBy);
  doc.setCreator("Wire Chief");
  doc.setSubject("Quantities only. No pricing.");
  doc.setKeywords(["wire-chief", "estimate", "no-pricing"]);
  return doc.save();
}

function draw(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(text || " ", { x, y: y - size, size, font, color });
  return y - size - 3;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
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
      } else current = next;
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["—"];
}

function trimTo(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let next = text;
  while (next.length > 1 && font.widthOfTextAtSize(`${next}…`, size) > width) next = next.slice(0, -1);
  return `${next}…`;
}

export function estimatePdfFileName(projectName: string, title: string): string {
  return `WireChief-Estimate-${slug(projectName)}-${slug(title)}.pdf`;
}
