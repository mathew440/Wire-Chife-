"use client";

import { useDbReady } from "@/components/db-ready";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSettings, listAllLogItems, listAllOrders, listProjects, listTasks, saveSettings } from "@/lib/data/repo";
import { buildAttention } from "@/lib/domain/attention";
import { DUE_SOON_DAYS } from "@/lib/domain/logs";
import { duePhrase, todayISO } from "@/lib/domain/dates";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { useEffect, useRef, useState } from "react";

export function RemindersCard() {
  const { status } = useDbReady();
  const today = todayISO();
  const projects = useLiveQuery(() => (status === "ready" ? listProjects() : undefined), [status]);
  const tasks = useLiveQuery(() => (status === "ready" ? listTasks() : undefined), [status]);
  const logItems = useLiveQuery(() => (status === "ready" ? listAllLogItems() : undefined), [status]);
  const orders = useLiveQuery(() => (status === "ready" ? listAllOrders() : undefined), [status]);
  const settings = useLiveQuery(() => (status === "ready" ? getSettings() : undefined), [status]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const sent = useRef(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (typeof Notification === "undefined") setPermission("unsupported");
      else setPermission(Notification.permission);
    });
  }, []);

  const groups =
    projects && tasks && logItems && orders ? buildAttention({ today, projects, logItems, tasks, orders }) : [];
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);

  useEffect(() => {
    if (!settings || sent.current || permission !== "granted" || count === 0) return;
    if (settings.lastNotifiedOn === today) return;
    sent.current = true;
    try {
      new Notification("Wire Chief", {
        body: `${count} item${count === 1 ? "" : "s"} overdue or due within ${DUE_SOON_DAYS} days.`,
        tag: "wire-chief-due",
      });
    } catch {
      sent.current = false;
      return;
    }
    void saveSettings({ ...settings, lastNotifiedOn: today });
  }, [settings, permission, count, today]);

  if (!projects || !tasks || !logItems || !orders) return null;

  async function enable() {
    if (typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setPermission(next);
  }

  return (
    <Card className="bg-card text-base">
      <CardContent className="grid gap-3">
        <h2 className="font-display text-2xl font-bold">Due and overdue</h2>
        <p className="text-sm text-muted-foreground">
          Submittals, RFIs, open items, and orders that are overdue or due within {DUE_SOON_DAYS} days. An order is late when the expected date has passed and it is not marked delivered. A row with no date stays off this list.
        </p>
        {permission === "unsupported" ? (
          <p className="text-sm text-muted-foreground">This browser does not offer notifications. This list still shows what is due.</p>
        ) : permission === "granted" ? (
          <p className="text-sm text-muted-foreground">Notifications are on for this browser. Wire Chief shows one a day when something is due.</p>
        ) : permission === "denied" ? (
          <p className="text-sm text-muted-foreground">Notifications are blocked in this browser. This list still shows what is due.</p>
        ) : (
          <Button type="button" variant="outline" onClick={() => void enable()}>
            Turn on notifications
          </Button>
        )}
        {groups.length === 0 ? (
          <p className="text-muted-foreground">Nothing is overdue or due within {DUE_SOON_DAYS} days.</p>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <section key={group.owner} className="grid gap-2">
                <h3 className="text-sm font-bold tracking-wide uppercase">{group.owner}</h3>
                <ul className="grid gap-2">
                  {group.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={item.href}
                        className={
                          item.timing === "overdue"
                            ? "grid gap-1 rounded-lg bg-orange/10 px-3 py-3 ring-2 ring-orange"
                            : "grid gap-1 rounded-lg bg-background px-3 py-3 ring-1 ring-border"
                        }
                      >
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.projectName} · {item.kind} · {duePhrase(item.dueDate, today)}
                          {item.timing === "overdue" ? (
                            <span className="font-bold text-orange"> · {item.kind === "order" ? "LATE" : "OVERDUE"}</span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
