"use client";

import { Mark } from "@/components/bits";
import { useDbReady } from "@/components/db-ready";
import { ServiceWorkerEffect } from "@/components/pwa";
import { Toaster } from "@/components/ui/sonner";
import { getProject, getSettings } from "@/lib/data/repo";
import { SEEDED_PROFILE_NAME, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarRange, Camera, ClipboardList, Contact, Database, FolderOpen, HardHat, LayoutDashboard, Package, ScrollText, Users } from "lucide-react";
import { AppLink as Link, useAppPathname } from "@/components/app-link";
import { Suspense, type ReactNode } from "react";
import { cn } from "cn";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="md:pl-64">
        <MobileBar />
        <main className="px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-10">{children}</main>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <Toaster position="top-center" />
      <ServiceWorkerEffect />
    </div>
  );
}

function MobileBar() {
  const { status } = useDbReady();
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Mark className="size-10" />
        <span className="font-display text-xl font-bold tracking-[0.14em]">WIRE CHIEF</span>
      </Link>
      <span className="max-w-[46%] text-right text-sm leading-tight text-muted-foreground">
        <span className="block truncate">{settings?.profileName || SEEDED_PROFILE_NAME}</span>
        <span className="block truncate text-xs">{settings?.profileRole || SEEDED_PROFILE_ROLE}</span>
      </span>
    </header>
  );
}

function Sidebar() {
  const pathname = useAppPathname() ?? "/";
  const projectId = projectIdFromPath(pathname);
  const { status } = useDbReady();
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const project = useLiveQuery(() => (status === "ready" && projectId ? getProject(projectId) : undefined), [status, projectId]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <Link href="/" className="flex items-center gap-3 px-4 py-5">
        <Mark className="size-11" />
        <span>
          <span className="font-display block text-xl leading-none font-bold tracking-[0.14em]">WIRE CHIEF</span>
          <span className="mt-1 block text-xs text-muted-foreground">{settings?.companyName ?? "AKA Electric"}</span>
        </span>
      </Link>
      <nav className="grid gap-1 px-3" aria-label="Main">
        <SideLink href="/" active={pathname === "/" || pathname.startsWith("/projects")} icon={<HardHat />}>
          Jobs
        </SideLink>
        <SideLink href="/crew" active={pathname.startsWith("/crew")} icon={<Users />}>
          Crew
        </SideLink>
        <SideLink href="/data" active={pathname.startsWith("/data")} icon={<Database />}>
          Data
        </SideLink>
        <SideLink href="/contacts" active={pathname.startsWith("/contacts")} icon={<Contact />}>
          Contacts
        </SideLink>
      </nav>
      {projectId && project ? (
        <div className="mt-6 px-3">
          <p className="px-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">This job</p>
          <p className="px-2 pt-2 font-display text-lg leading-tight font-bold">{project.name}</p>
          <nav className="mt-2 grid gap-1" aria-label="This job">
            <SideLink href={`/projects/${projectId}`} active={pathname === `/projects/${projectId}`} icon={<LayoutDashboard />}>
              Dashboard
            </SideLink>
            <SideLink href={`/projects/${projectId}/reports`} active={pathname.includes("/reports")} icon={<ClipboardList />}>
              Reports
            </SideLink>
            <SideLink href={`/projects/${projectId}/tasks`} active={pathname.includes("/tasks")} icon={<ClipboardList />}>
              Open items
            </SideLink>
            <SideLink href={`/projects/${projectId}/submittals`} active={pathname.includes("/submittals")} icon={<ScrollText />}>
              Submittals
            </SideLink>
            <SideLink href={`/projects/${projectId}/rfis`} active={pathname.includes("/rfis")} icon={<ScrollText />}>
              RFIs
            </SideLink>
            <SideLink href={`/projects/${projectId}/lookahead`} active={pathname.includes("/lookahead")} icon={<CalendarRange />}>
              Look-ahead
            </SideLink>
            <SideLink href={`/projects/${projectId}/photos`} active={pathname.includes("/photos")} icon={<Camera />}>
              Photos
            </SideLink>
            <SideLink href={`/projects/${projectId}/estimates`} active={pathname.includes("/estimates")} icon={<Package />}>
              Estimates
            </SideLink>
            <SideLink href={`/projects/${projectId}/files`} active={pathname.includes("/files")} icon={<FolderOpen />}>
              Files
            </SideLink>
          </nav>
        </div>
      ) : null}
      <p className="mt-auto px-5 py-4 text-xs text-muted-foreground">
        {settings?.profileName || SEEDED_PROFILE_NAME}
        <span className="mt-1 block">{settings?.profileRole || SEEDED_PROFILE_ROLE}</span>
        <span className="mt-1 block">Saved on this device. No account.</span>
      </p>
    </aside>
  );
}

function SideLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold",
        active ? "bg-teal text-teal-ink" : "text-foreground hover:bg-sidebar-accent",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="[&_svg]:size-5">{icon}</span>
      {children}
    </Link>
  );
}

function BottomNav() {
  const pathname = useAppPathname() ?? "/";
  const items = [
    { href: "/", label: "Jobs", icon: <HardHat />, active: pathname === "/" || pathname.startsWith("/projects") },
    { href: "/crew", label: "Crew", icon: <Users />, active: pathname.startsWith("/crew") },
    { href: "/data", label: "Data", icon: <Database />, active: pathname.startsWith("/data") },
    { href: "/contacts", label: "Contacts", icon: <Contact />, active: pathname.startsWith("/contacts") },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Main"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold tracking-wide",
                item.active ? "text-teal" : "text-muted-foreground",
              )}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="[&_svg]:size-6">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ProjectTabs({
  projectId,
  current,
}: {
  projectId: string;
  current: "dashboard" | "reports" | "tasks" | "submittals" | "rfis" | "lookahead" | "photos" | "estimates" | "files";
}) {
  const tabs = [
    ["dashboard", "Dashboard", `/projects/${projectId}`],
    ["reports", "Reports", `/projects/${projectId}/reports`],
    ["tasks", "Open items", `/projects/${projectId}/tasks`],
    ["submittals", "Submittals", `/projects/${projectId}/submittals`],
    ["rfis", "RFIs", `/projects/${projectId}/rfis`],
    ["lookahead", "Look-ahead", `/projects/${projectId}/lookahead`],
    ["photos", "Photos", `/projects/${projectId}/photos`],
    ["estimates", "Estimates", `/projects/${projectId}/estimates`],
    ["files", "Files", `/projects/${projectId}/files`],
  ] as const;
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Job sections">
      {tabs.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "inline-flex h-12 shrink-0 items-center rounded-lg px-4 text-sm font-bold",
            current === key ? "bg-teal text-teal-ink" : "bg-card text-foreground ring-1 ring-border",
          )}
          aria-current={current === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function projectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return decodeURIComponent(match[1]);
}
