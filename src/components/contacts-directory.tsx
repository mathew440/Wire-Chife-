"use client";

import { Field, PageIntro, TextField } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/data/repo";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { useState } from "react";

export function ContactsDirectory() {
  const { status, error } = useDbReady();
  const projects = useLiveQuery(() => (status === "ready" ? listProjects() : undefined), [status]);
  const [query, setQuery] = useState("");

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !projects) return <PageFallback />;

  const needle = query.trim().toLowerCase();
  const rows = projects.flatMap((project) =>
    project.contacts
      .filter((contact) => contact.name.trim() || contact.email.trim() || contact.company.trim() || contact.phone.trim())
      .map((contact) => ({ contact, project })),
  );
  const shown = rows.filter(({ contact, project }) => {
    if (!needle) return true;
    const haystack = [contact.name, contact.company, contact.email, contact.role, contact.phone, project.name, project.jobNumber]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <div className="grid gap-5">
      <PageIntro
        eyebrow="All jobs"
        title="Contacts"
        description="People saved on each job. Company and email show here and on the job edit screen. Nothing is looked up off this device."
      />
      <Field label="Find">
        <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, email, or job" />
      </Field>
      {rows.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add a contact while you edit a job. It will show up here."
          action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>}
        />
      ) : shown.length === 0 ? (
        <EmptyState title="No match" body="Try a different name, company, or job." />
      ) : (
        <ul className="grid gap-3">
          {shown.map(({ contact, project }) => (
            <li key={`${project.id}-${contact.id}`} className="grid gap-1 rounded-xl bg-card px-4 py-4 ring-1 ring-border">
              <p className="font-display text-2xl font-bold">{contact.name || "Unnamed"}</p>
              <p className="text-sm text-muted-foreground">
                {[contact.company, contact.role].filter(Boolean).join(" · ") || "No company or role"}
              </p>
              {contact.email ? (
                <a className="text-base font-semibold text-teal" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No email</p>
              )}
              {contact.phone ? (
                <a className="text-base font-semibold text-teal" href={`tel:${contact.phone}`}>
                  {contact.phone}
                </a>
              ) : null}
              <Link href={`/projects/${project.id}/edit`} className="text-sm font-semibold">
                {project.name}
                {project.jobNumber ? ` · Job ${project.jobNumber}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
