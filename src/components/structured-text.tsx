"use client";

import { Button } from "@/components/ui/button";
import { displayTitle, foldProse, parseProse, richTokens, type ProsePart, type ProseSection } from "@/lib/domain/prose";
import { useState } from "react";

export function StructuredText({ text, collapsible = false }: { text: string; collapsible?: boolean }) {
  const sections = parseProse(text);
  const [open, setOpen] = useState(false);
  if (sections.length === 0) return null;
  const { shown, hidden } = collapsible ? foldProse(sections) : { shown: sections, hidden: [] };
  const visible = open ? sections : shown;

  return (
    <div className="grid min-w-0 gap-4 [overflow-wrap:anywhere]">
      {visible.map((section, index) => (
        <SectionView key={`${section.title ?? "intro"}-${index}`} section={section} />
      ))}
      {hidden.length > 0 ? (
        <Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Hide details" : "Details"}
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
      <ul className="grid min-w-0 list-disc gap-3 pl-5 text-[17px] leading-[1.6] text-foreground">
        {(part.items ?? []).map((item, index) => (
          <li key={index}>
            <Rich text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="min-w-0 text-[17px] leading-[1.6] text-foreground">
      <Rich text={part.text ?? ""} />
    </p>
  );
}

function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={lineIndex}>
      {lineIndex > 0 ? <br /> : null}
      <RichLine text={line} />
    </span>
  ));
}

function RichLine({ text }: { text: string }) {
  const tokens = richTokens(text);
  if (tokens.length === 0) return null;
  return tokens.map((token, index) => {
    if (token.kind === "verify") return <VerificationTag key={index} />;
    if (token.kind === "link" && token.href) {
      return (
        <a
          key={index}
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal underline [overflow-wrap:anywhere]"
        >
          <WrappedUrl value={token.value} />
        </a>
      );
    }
    return <span key={index}>{token.value}</span>;
  });
}

function WrappedUrl({ value }: { value: string }) {
  const pieces = value.split(/([/?&=_-])/);
  return pieces.map((piece, index) => (
    <span key={index}>
      {piece}
      {/[/?&=_-]/.test(piece) ? <wbr /> : null}
    </span>
  ));
}

function VerificationTag() {
  return (
    <span className="mx-1 inline-flex items-center rounded-md bg-orange px-2 py-1 text-[16px] leading-none font-bold text-orange-ink">
      Needs verification
    </span>
  );
}
