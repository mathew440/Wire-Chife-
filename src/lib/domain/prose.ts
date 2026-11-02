/** A label Mat can type in all caps, with an optional date in parentheses. */
const KNOWN_LABELS = ["SCOPE ON RECORD", "KEY FACTS", "DEMARCATION", "STATUS", "NOTES"];

const MARKER = /\[\s*needs verification\s*\]/i;

export interface ProsePart {
  type: "paragraph" | "list";
  text?: string;
  items?: string[];
}

export interface ProseSection {
  title: string | null;
  /** Status and Scope stay visible when the rest is folded. */
  summary: boolean;
  parts: ProsePart[];
}

export function parseProse(text: string): ProseSection[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const sections = normalized.includes("\n") ? parseLines(normalized) : parseInline(normalized);
  return sections.filter((section) => section.title || section.parts.length > 0);
}

export function summarySplit(sections: ProseSection[]): { shown: ProseSection[]; hidden: ProseSection[] } {
  const labeled = sections.some((section) => section.summary);
  if (!labeled) return { shown: sections, hidden: [] };
  const shown = sections.filter((section) => section.summary || section.title == null);
  const hidden = sections.filter((section) => !shown.includes(section));
  return { shown, hidden };
}

/** Fold a long unlabeled description. Labeled Status and Scope stay put. */
export function foldProse(sections: ProseSection[]): { shown: ProseSection[]; hidden: ProseSection[] } {
  const labeled = summarySplit(sections);
  if (labeled.hidden.length > 0) return labeled;
  if (proseWeight(sections) <= 420) return { shown: sections, hidden: [] };
  return clipLong(sections);
}

export interface RichToken {
  kind: "text" | "link" | "verify";
  value: string;
  href?: string;
}

/** Split visible text into words, tappable http(s) links, and verification marks. */
export function richTokens(text: string): RichToken[] {
  const token = /https?:\/\/[^\s<>"']+|\[\s*needs verification\s*\]/gi;
  const tokens: RichToken[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: "text", value: text.slice(last, index) });
    const raw = match[0];
    if (raw.startsWith("[")) {
      tokens.push({ kind: "verify", value: raw });
    } else {
      const trimmed = raw.replace(/[),.;:!?]+$/, "");
      tokens.push({ kind: "link", value: trimmed, href: trimmed });
      const trailing = raw.slice(trimmed.length);
      if (trailing) tokens.push({ kind: "text", value: trailing });
    }
    last = index + raw.length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

export function previewLine(text: string): string {
  const { shown } = summarySplit(parseProse(text));
  const part = shown.flatMap((section) => section.parts)[0];
  if (!part) return "";
  if (part.type === "list") return part.items?.[0] ?? "";
  return part.text ?? "";
}

export function displayTitle(title: string): string {
  const match = /^([^(]+?)(\s*\(.*\))?$/.exec(title.trim());
  const words = (match?.[1] ?? title)
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return `${words}${match?.[2] ?? ""}`.replace(/\s+/g, " ").trim();
}

export function hasVerification(text: string): boolean {
  return MARKER.test(text);
}

function parseInline(text: string): ProseSection[] {
  const marks = findLabels(text);
  if (marks.length === 0) return [makeSection(null, [text])];
  const sections: ProseSection[] = [];
  const preamble = text.slice(0, marks[0].index).trim();
  if (preamble) sections.push(makeSection(null, [preamble]));
  marks.forEach((mark, index) => {
    const next = marks[index + 1]?.index ?? text.length;
    const body = text.slice(mark.end, next).trim();
    sections.push(makeSection(mark.title, body ? [body] : []));
  });
  return sections;
}

function parseLines(text: string): ProseSection[] {
  const sections: Array<{ title: string | null; chunks: string[][] }> = [];
  let current = { title: null as string | null, chunks: [[]] as string[][] };
  sections.push(current);
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      if (current.chunks[current.chunks.length - 1].length > 0) current.chunks.push([]);
      continue;
    }
    const heading = headingFromLine(line);
    if (heading) {
      const empty = current.title == null && current.chunks.every((chunk) => chunk.length === 0);
      if (!empty) {
        current = { title: heading.title, chunks: [[]] };
        sections.push(current);
      } else {
        current.title = heading.title;
      }
      if (heading.rest) current.chunks[current.chunks.length - 1].push(heading.rest);
      continue;
    }
    current.chunks[current.chunks.length - 1].push(line);
  }
  return sections.map((section) => makeSection(section.title, section.chunks.flatMap((chunk) => (chunk.length ? [chunk.join("\n")] : []))));
}

function makeSection(title: string | null, bodies: string[]): ProseSection {
  return {
    title,
    summary: isSummaryTitle(title),
    parts: bodies.flatMap((body) => partsFromBody(body)),
  };
}

function partsFromBody(body: string): ProsePart[] {
  const blocks = body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    // A return in the middle of a sentence stays in the paragraph. Only lines that
    // already read as separate items become bullets.
    if (lines.length >= 2 && lines.every((line) => line.length <= 160 && isItemLine(line))) {
      return { type: "list", items: lines.map(itemText) };
    }
    if (lines.length === 1) {
      const sentences = splitSentences(lines[0]);
      if (sentences.length >= 2 && sentences.every((sentence) => sentence.length <= 160)) {
        return { type: "list", items: sentences };
      }
    }
    return { type: "paragraph", text: lines.join("\n") };
  });
}

function isItemLine(line: string): boolean {
  if (/^[-*•]\s+\S/.test(line)) return true;
  return /[.!?…][)"'\]]*(?:\s*\[\s*needs verification\s*\])?\s*$/i.test(line);
}

function itemText(line: string): string {
  return line.replace(/^[-*•]\s+/, "");
}

function proseWeight(sections: ProseSection[]): number {
  return sections.reduce((sum, section) => sum + sectionText(section).length, 0);
}

function sectionText(section: ProseSection): string {
  const parts = section.parts.map((part) => (part.type === "list" ? (part.items ?? []).join("\n") : (part.text ?? "")));
  return [section.title ?? "", ...parts].join("\n");
}

function clipLong(sections: ProseSection[]): { shown: ProseSection[]; hidden: ProseSection[] } {
  const first = sections[0];
  if (!first) return { shown: sections, hidden: [] };
  const part = first.parts[0];
  if (part?.type === "list" && (part.items?.length ?? 0) > 3) {
    const items = part.items ?? [];
    const rest = [{ title: null, summary: false, parts: [{ type: "list" as const, items: items.slice(3) }, ...first.parts.slice(1)] }, ...sections.slice(1)];
    return {
      shown: [{ ...first, parts: [{ type: "list", items: items.slice(0, 3) }] }],
      hidden: rest.filter((section) => section.parts.some((item) => (item.items?.length ?? 0) > 0 || item.text)),
    };
  }
  if (first.parts.length > 1) {
    return {
      shown: [{ ...first, parts: [first.parts[0]] }],
      hidden: [{ title: null, summary: false, parts: first.parts.slice(1) }, ...sections.slice(1)].filter((section) => section.parts.length > 0),
    };
  }
  if (sections.length > 1) return { shown: [first], hidden: sections.slice(1) };
  if (part?.type === "paragraph" && (part.text?.length ?? 0) > 280) {
    const text = part.text ?? "";
    const space = text.lastIndexOf(" ", 280);
    const clipped = `${text.slice(0, space > 80 ? space : 280).trimEnd()}…`;
    return {
      shown: [{ ...first, parts: [{ type: "paragraph", text: clipped }] }],
      hidden: [first],
    };
  }
  return { shown: sections, hidden: [] };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z[])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isSummaryTitle(title: string | null): boolean {
  if (!title) return false;
  const upper = title.toUpperCase();
  return upper.startsWith("STATUS") || upper.startsWith("SCOPE");
}

function headingFromLine(line: string): { title: string; rest: string } | null {
  const found = matchLabel(line, 0);
  if (found && found.index === 0) {
    return { title: found.title, rest: line.slice(found.end).trim() };
  }
  const bare = line.replace(/\s*[:.]\s*$/, "").trim();
  if (bare === line.trim()) return null;
  if (KNOWN_LABELS.includes(bare) || isGenericLabel(bare)) return { title: bare, rest: "" };
  if (KNOWN_LABELS.includes(line.trim()) || isGenericLabel(line.trim())) return { title: line.trim(), rest: "" };
  return null;
}

function findLabels(text: string): Array<{ index: number; end: number; title: string }> {
  const marks: Array<{ index: number; end: number; title: string }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const found = matchLabel(text, index);
    if (!found) continue;
    marks.push(found);
    index = found.end - 1;
  }
  return marks;
}

function matchLabel(source: string, index: number): { index: number; end: number; title: string } | null {
  if (index > 0 && /[A-Za-z0-9]/.test(source[index - 1] ?? "")) return null;
  const slice = source.slice(index);
  const known = KNOWN_LABELS.find((label) => slice.startsWith(label));
  let raw = known ?? "";
  if (!raw) {
    const generic = /^([A-Z][A-Z0-9]+(?:[ /&-][A-Z0-9]+)*)/.exec(slice);
    if (generic && isGenericLabel(generic[1])) raw = generic[1];
  }
  if (!raw) return null;
  let cursor = raw.length;
  const paren = /^\s*\([^)\n]{1,48}\)/.exec(slice.slice(cursor));
  if (paren) cursor += paren[0].length;
  const punct = /^\s*[:.]/.exec(slice.slice(cursor));
  if (!punct) return null;
  cursor += punct[0].length;
  return { index, end: index + cursor, title: slice.slice(0, cursor).replace(/\s*[:.]\s*$/, "").trim() };
}

function isGenericLabel(value: string): boolean {
  if (!/^[A-Z][A-Z0-9 /&-]{3,}$/.test(value)) return false;
  const words = value.split(/[ /&-]+/).filter(Boolean);
  if (words.some((word) => !/^[A-Z0-9]{2,}$/.test(word))) return false;
  if (words.length === 1) return words[0].length >= 5;
  return true;
}
