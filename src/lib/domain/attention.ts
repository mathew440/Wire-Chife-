import type { LogItem, MaterialOrder, Project, Task } from "@/lib/data/types";
import { isOpenTask, isOverdueTask } from "@/lib/domain/dashboard";
import { addDays } from "@/lib/domain/dates";
import { DUE_SOON_DAYS, isDueSoonLog, isOverdueLog } from "@/lib/domain/logs";
import { isDueSoonOrder, isLateOrder } from "@/lib/domain/orders";

export interface AttentionItem {
  id: string;
  projectId: string;
  projectName: string;
  kind: "submittal" | "rfi" | "open item" | "order";
  label: string;
  owner: string;
  dueDate: string;
  timing: "overdue" | "due-soon";
  href: string;
}

export interface AttentionGroup {
  owner: string;
  items: AttentionItem[];
}

const NO_OWNER = "No owner";

export function buildAttention(input: {
  today: string;
  projects: Project[];
  logItems: LogItem[];
  tasks: Task[];
  orders?: MaterialOrder[];
}): AttentionGroup[] {
  const names = new Map(input.projects.map((project) => [project.id, project.name]));
  const items: AttentionItem[] = [];
  const soon = addDays(input.today, DUE_SOON_DAYS);

  for (const item of input.logItems) {
    if (item.deletedAt || !item.dueDate) continue;
    const overdue = isOverdueLog(item, input.today);
    const dueSoon = isDueSoonLog(item, input.today);
    if (!overdue && !dueSoon) continue;
    const projectName = names.get(item.projectId);
    if (!projectName) continue;
    items.push({
      id: item.id,
      projectId: item.projectId,
      projectName,
      kind: item.kind,
      label: item.number ? `${item.number} · ${item.description || "No description"}` : item.description || "No description",
      owner: item.ballInCourt.trim() || NO_OWNER,
      dueDate: item.dueDate,
      timing: overdue ? "overdue" : "due-soon",
      href: `/projects/${item.projectId}/${item.kind === "rfi" ? "rfis" : "submittals"}/${item.id}`,
    });
  }

  for (const order of input.orders ?? []) {
    if (order.deletedAt || !order.expectedDate) continue;
    const late = isLateOrder(order, input.today);
    const dueSoon = isDueSoonOrder(order, input.today);
    if (!late && !dueSoon) continue;
    const projectName = names.get(order.projectId);
    if (!projectName) continue;
    items.push({
      id: order.id,
      projectId: order.projectId,
      projectName,
      kind: "order",
      label: order.description || "Order",
      owner: order.vendor.trim() || "No vendor",
      dueDate: order.expectedDate,
      timing: late ? "overdue" : "due-soon",
      href: `/projects/${order.projectId}/orders`,
    });
  }

  for (const task of input.tasks) {
    if (!isOpenTask(task) || !task.dueDate) continue;
    const overdue = isOverdueTask(task, input.today);
    const dueSoon = task.dueDate >= input.today && task.dueDate <= soon;
    if (!overdue && !dueSoon) continue;
    const projectName = names.get(task.projectId);
    if (!projectName) continue;
    items.push({
      id: task.id,
      projectId: task.projectId,
      projectName,
      kind: "open item",
      label: task.title,
      owner: task.owner.trim() || NO_OWNER,
      dueDate: task.dueDate,
      timing: overdue ? "overdue" : "due-soon",
      href: `/projects/${task.projectId}/tasks/${task.id}`,
    });
  }

  const groups = new Map<string, AttentionItem[]>();
  for (const item of items) {
    const list = groups.get(item.owner) ?? [];
    list.push(item);
    groups.set(item.owner, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === NO_OWNER) return 1;
      if (b === NO_OWNER) return -1;
      return a.localeCompare(b);
    })
    .map(([owner, rows]) => ({
      owner,
      items: rows.sort((a, b) => {
        if (a.timing !== b.timing) return a.timing === "overdue" ? -1 : 1;
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return a.label.localeCompare(b.label);
      }),
    }));
}
