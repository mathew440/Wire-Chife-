"use client";

import { Field, PageIntro, SelectField, TextField } from "@/components/bits";
import { ContactCard } from "@/components/contact-card";
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
  const [jobId, setJobId] = useState("");

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || !projects) return <PageFallback />;

  const needle = query.trim().toLowerCase();
  const rows = projects.flatMap((project) =>
    project.contacts
      .filter((contact) => contact.name.trim() || contact.email.trim() || contact.company.trim() || contact.phone.trim() || contact.role.trim())
      .map((contact) => ({ contact, project })),
  );
  const shown = rows.filter(({ contact, project }) => {
    if (jobId && project.id !== jobId) return false;
    if (!needle) return true;
    const haystack = [contact.name, contact.company, contact.email, contact.role, contact.phone, project.name, project.jobNumber]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
  const jobs = projects.filter((project) => project.contacts.some((contact) => contact.name.trim() || contact.company.trim() || contact.role.trim()));

  return (
    <div className="grid gap-5">
      <PageIntro
        eyebrow="All jobs"
        title="Contacts"
        description="People saved on each job. Company, role, and address each get their own line. Nothing is looked up off this device."
      />
      <div className="grid gap-4">
        <Field label="Find">
          <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, email, or job" />
        </Field>
        <Field label="Job">
          <SelectField value={jobId} onChange={(event) => setJobId(event.target.value)} aria-label="Filter by job">
            <option value="">All jobs</option>
            {jobs.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.jobNumber ? ` · ${project.jobNumber}` : ""}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add a contact while you edit a job. It will show up here."
          action={<Button nativeButton={false} render={<Link href="/" />}>Back to jobs</Button>}
        />
      ) : shown.length === 0 ? (
        <EmptyState title="No match" body="Try a different name, company, or job." />
      ) : (
        <ul className="grid gap-4">
          {shown.map(({ contact, project }) => (
            <li key={`${project.id}-${contact.id}`}>
              <ContactCard
                contact={contact}
                job={{ id: project.id, name: project.name, jobNumber: project.jobNumber }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
