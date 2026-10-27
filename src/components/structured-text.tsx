"use client";

import { Button } from "@/components/ui/button";
import { displayTitle, parseProse, summarySplit, type ProsePart, type ProseSection } from "@/lib/domain/prose";
import { useState, type ReactNode } from "react";

const MARKER = /\[\s*needs verification\s*\]/gi;

export function StructuredText({ text, collapsible = false }: { text: string; collapsible?: boolean }) {
  const sections = parseProse(text);
  const [open, setOpen] = useState(false);
  if (sections.length === 0) return null;
  const { shown, hidden } = collapsible ? summarySplit(sections) : { shown: sections, hidden: [] };
  const visible = open ? sections : shown;

  return (
    <div className="grid gap-4">
      {visible.map((section, index) => (
        <SectionView key={`${section.title ?? "intro"}-${index}`} section={section} />
      ))}
      {hidden.length > 0 ? (
        <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide full details" : "Show full details"}
        </Button>
      ) : null}
    </div>
  );
}

function SectionView({ section }: { section: ProseSection }) {
  return (
    <section className="grid gap-3">
      {section.title ? <h3 className="text-[16px] leading-snug font-bold tracking-wide">{displayTitle(section.title)}</h3> : null}
      {section.parts.map((part, index) => (
        <PartView key={index} part={part} />
      ))}
    </section>
  );
}

function PartView({ part }: { part: ProsePart }) {
  if (part.type === "list") {
    return (
      <ul className="grid list-disc gap-3 pl-5 text-[17px] leading-[1.6] text-foreground">
        {(part.items ?? []).map((item, index) => (
          <li key={index}>
            <Rich text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-[17px] leading-[1.6] text-foreground">
      <Rich text={part.text ?? ""} />
    </p>
  );
}

function Rich({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    nodes.push(<VerificationTag key={index} />);
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.length === 0) return text;
  return <>{nodes}</>;
}

function VerificationTag() {
  return (
    <span className="mx-1 inline-flex items-center rounded-md bg-orange px-2 py-1 text-[16px] leading-none font-bold text-orange-ink">
      Needs verification
    </span>
  );
}
