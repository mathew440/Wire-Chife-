import { appPathname } from "@/lib/base-path";

export type AppRoute =
  | { name: "home" }
  | { name: "crew" }
  | { name: "data" }
  | { name: "project-new" }
  | { name: "project"; id: string }
  | { name: "project-edit"; id: string }
  | { name: "reports"; id: string }
  | { name: "report"; id: string; reportId: string }
  | { name: "tasks"; id: string }
  | { name: "task"; id: string; taskId: string }
  | { name: "estimates"; id: string }
  | { name: "estimate"; id: string; estimateId: string }
  | { name: "files"; id: string }
  | { name: "file"; id: string; fileId: string }
  | { name: "submittals"; id: string }
  | { name: "submittal"; id: string; itemId: string }
  | { name: "rfis"; id: string }
  | { name: "rfi"; id: string; itemId: string }
  | { name: "lookahead"; id: string }
  | { name: "photos"; id: string }
  | { name: "orders"; id: string }
  | { name: "hours"; id: string }
  | { name: "contacts" }
  | { name: "missing" };

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Map an app or public pathname onto a screen. Unknown job ids still match. */
export function matchRoute(pathname: string): AppRoute {
  const parts = appPathname(pathname).split("/").filter(Boolean).map(decodePart);
  if (parts.length === 0) return { name: "home" };
  if (parts.length === 1 && parts[0] === "crew") return { name: "crew" };
  if (parts.length === 1 && parts[0] === "data") return { name: "data" };
  if (parts.length === 1 && parts[0] === "contacts") return { name: "contacts" };
  if (parts[0] !== "projects") return { name: "missing" };
  if (parts.length === 2 && parts[1] === "new") return { name: "project-new" };
  if (parts.length === 2) return { name: "project", id: parts[1] };
  const id = parts[1];
  if (!id || id === "new") return { name: "missing" };
  if (parts.length === 3 && parts[2] === "edit") return { name: "project-edit", id };
  const section = parts[2];
  if (section === "reports" && parts.length === 3) return { name: "reports", id };
  if (section === "reports" && parts.length === 4) return { name: "report", id, reportId: parts[3] };
  if (section === "tasks" && parts.length === 3) return { name: "tasks", id };
  if (section === "tasks" && parts.length === 4) return { name: "task", id, taskId: parts[3] };
  if (section === "estimates" && parts.length === 3) return { name: "estimates", id };
  if (section === "estimates" && parts.length === 4) return { name: "estimate", id, estimateId: parts[3] };
  if (section === "files" && parts.length === 3) return { name: "files", id };
  if (section === "files" && parts.length === 4) return { name: "file", id, fileId: parts[3] };
  if (section === "submittals" && parts.length === 3) return { name: "submittals", id };
  if (section === "submittals" && parts.length === 4) return { name: "submittal", id, itemId: parts[3] };
  if (section === "rfis" && parts.length === 3) return { name: "rfis", id };
  if (section === "rfis" && parts.length === 4) return { name: "rfi", id, itemId: parts[3] };
  if (section === "lookahead" && parts.length === 3) return { name: "lookahead", id };
  if (section === "photos" && parts.length === 3) return { name: "photos", id };
  if (section === "orders" && parts.length === 3) return { name: "orders", id };
  if (section === "hours" && parts.length === 3) return { name: "hours", id };
  return { name: "missing" };
}
