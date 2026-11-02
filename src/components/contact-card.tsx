"use client";

import { mapsUrl, presentContact, type ContactCardFields } from "@/lib/domain/contact-card";
import { AppLink as Link } from "@/components/app-link";

export function ContactCard({
  contact,
  job,
  compact = false,
}: {
  contact: ContactCardFields;
  job?: { id: string; name: string; jobNumber: string };
  compact?: boolean;
}) {
  const view = presentContact(contact);
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border-2 border-border bg-card px-4 py-4">
      <h2
        className={
          compact
            ? "font-display text-2xl leading-tight font-bold break-words [overflow-wrap:anywhere]"
            : "font-display text-3xl leading-tight font-bold break-words [overflow-wrap:anywhere]"
        }
      >
        {view.name}
      </h2>
      {view.company ? <p className="text-[17px] leading-[1.6] break-words [overflow-wrap:anywhere]">{view.company}</p> : null}
      {view.roleCompany ? <p className="text-[17px] leading-[1.6] break-words [overflow-wrap:anywhere]">{view.roleCompany}</p> : null}
      {view.role ? <p className="text-[17px] leading-[1.6] break-words [overflow-wrap:anywhere]">{view.role}</p> : null}
      {view.address ? (
        <a className="text-[17px] leading-[1.6] font-semibold break-words text-teal underline [overflow-wrap:anywhere]" href={mapsUrl(view.address)}>
          {view.address}
        </a>
      ) : null}
      {view.note ? <p className="text-[16px] leading-[1.6] break-words text-muted-foreground [overflow-wrap:anywhere]">{`Note: ${view.note}`}</p> : null}
      {view.phone ? (
        <a
          className="flex min-h-12 items-center justify-center rounded-lg bg-teal px-4 py-2 text-center text-[17px] font-bold break-all whitespace-normal text-teal-ink"
          href={`tel:${view.phone}`}
        >
          {view.phone}
        </a>
      ) : null}
      {view.email ? (
        <a
          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-teal px-4 py-2 text-center text-[17px] font-bold break-all whitespace-normal text-teal"
          href={`mailto:${view.email}`}
        >
          {view.email}
        </a>
      ) : (
        <p className="text-[16px] leading-[1.6] text-muted-foreground">No email</p>
      )}
      {job ? (
        <Link
          href={`/projects/${job.id}`}
          className="inline-flex min-h-12 max-w-full items-center rounded-lg bg-secondary px-3 py-2 text-[16px] font-bold break-words whitespace-normal [overflow-wrap:anywhere]"
        >
          {job.name}
          {job.jobNumber ? ` · Job ${job.jobNumber}` : ""}
        </Link>
      ) : null}
    </article>
  );
}
