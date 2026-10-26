"use client";

import { AreaField, Field, PageIntro, SelectField, TextField } from "@/components/bits";
import { ProjectTabs } from "@/components/chrome";
import { useDbReady } from "@/components/db-ready";
import { EmptyState, InlineError, PageFallback, StorageError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { blankOrder } from "@/lib/data/factories";
import { deleteOrder, getProject, listOrders, saveOrder } from "@/lib/data/repo";
import type { MaterialOrder, OrderStatus } from "@/lib/data/types";
import { LastEdited } from "@/components/sync-status";
import { formatDay, todayISO } from "@/lib/domain/dates";
import { isDueSoonOrder, isLateOrder, ORDER_STATUS_OPTIONS, orderStatusLabel } from "@/lib/domain/orders";
import { useLiveQuery } from "dexie-react-hooks";
import { AppLink as Link } from "@/components/app-link";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";

export function OrdersScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, error } = useDbReady();
  const today = todayISO();
  const project = useLiveQuery(async () => (status === "ready" ? ((await getProject(id)) ?? null) : undefined), [id, status]);
  const orders = useLiveQuery(() => (status === "ready" ? listOrders(id) : undefined), [id, status]);
  const [draft, setDraft] = useState<MaterialOrder>(() => blankOrder(id));
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  if (status === "error") return <StorageError message={error ?? "Storage error"} />;
  if (status !== "ready" || project === undefined || !orders) return <PageFallback />;
  if (project === null) {
    return (
      <EmptyState
        title="This job is not on this device"
        body="It may have been removed, or this link is from another phone."
        action={
          <Button nativeButton={false} render={<Link href="/" />}>
            Back to jobs
          </Button>
        }
      />
    );
  }

  const shown = orders.filter((order) => statusFilter === "all" || order.status === statusFilter);

  function update(partial: Partial<MaterialOrder>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function startEdit(order: MaterialOrder) {
    setDraft(order);
    setEditing(true);
    setFormError(null);
  }

  function clearForm() {
    setDraft(blankOrder(id));
    setEditing(false);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await saveOrder(draft);
      toast.success(editing ? "Order saved on this device" : "Order added on this device");
      clearForm();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save the order");
    }
  }

  async function changeStatus(order: MaterialOrder, next: OrderStatus) {
    try {
      const saved = await saveOrder({ ...order, status: next });
      setDraft((current) => (current.id === order.id ? { ...current, status: saved.status } : current));
      toast.success("Status saved on this device");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the status");
    }
  }

  async function remove(order: MaterialOrder) {
    try {
      await deleteOrder(order.id);
      if (draft.id === order.id) {
        setDraft(blankOrder(id));
        setEditing(false);
      }
      toast.success("Order removed");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove the order");
    }
  }

  return (
    <div className="grid gap-5">
      <ProjectTabs projectId={id} current="orders" />
      <PageIntro
        eyebrow={project.name}
        title="Orders"
        description="Material and equipment you are waiting on. An order is late when the expected date has passed and it is not marked delivered. Due soon means within 7 days. A blank expected date is neither."
      />
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 className="font-display text-2xl font-bold">{editing ? "Edit this order" : "Add an order"}</h2>
        <Field label="What you ordered">
          <TextField value={draft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Panel, wire, gear" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who you ordered it from">
            <TextField value={draft.vendor} onChange={(event) => update({ vendor: event.target.value })} placeholder="Supplier" />
          </Field>
          <Field label="PO number">
            <TextField value={draft.poNumber} onChange={(event) => update({ poNumber: event.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many">
            <TextField value={draft.quantity} onChange={(event) => update({ quantity: event.target.value })} placeholder="12 or 12 boxes" />
          </Field>
          <Field label="Status">
            <SelectField value={draft.status} onChange={(event) => update({ status: event.target.value as OrderStatus })}>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date ordered">
            <TextField type="date" value={draft.orderedDate ?? ""} onChange={(event) => update({ orderedDate: event.target.value || null })} />
          </Field>
          <Field label="Expected on site">
            <TextField type="date" value={draft.expectedDate ?? ""} onChange={(event) => update({ expectedDate: event.target.value || null })} />
          </Field>
          <Field label="Arrived" hint="Leave blank until it is on site.">
            <TextField type="date" value={draft.deliveredDate ?? ""} onChange={(event) => update({ deliveredDate: event.target.value || null })} />
          </Field>
        </div>
        <Field label="Notes">
          <AreaField value={draft.notes} onChange={(event) => update({ notes: event.target.value })} />
        </Field>
        <InlineError message={formError} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editing ? "Save order" : "Add order"}</Button>
          {editing ? (
            <Button type="button" variant="outline" onClick={clearForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <Field label="Show">
        <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}>
          <option value="all">All statuses</option>
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </Field>

      {shown.length === 0 ? (
        <EmptyState title="No orders in this list" body="Add one above, or choose All statuses." />
      ) : (
        <ul className="grid gap-3">
          {shown.map((order) => {
            const late = isLateOrder(order, today);
            const dueSoon = isDueSoonOrder(order, today);
            return (
              <li key={order.id} className={late ? "rounded-xl bg-orange/10 ring-2 ring-orange" : "rounded-xl bg-card ring-1 ring-border"}>
                <div className="grid gap-3 px-4 py-4">
                  <div className="grid gap-1">
                    <span className="font-display text-2xl font-bold">{order.description}</span>
                    <span className="text-base">{order.vendor || "No vendor"}</span>
                    <span className="text-sm text-muted-foreground">
                      {order.quantity ? `How many: ${order.quantity}` : "How many: not entered"}
                      {order.poNumber ? ` · PO ${order.poNumber}` : ""}
                      {` · ${orderStatusLabel(order.status)}`}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {order.expectedDate ? `Expected ${formatDay(order.expectedDate, today)}` : "No expected date"}
                      {order.orderedDate ? ` · Ordered ${formatDay(order.orderedDate, today)}` : ""}
                      {order.deliveredDate ? ` · Arrived ${formatDay(order.deliveredDate, today)}` : ""}
                    </span>
                    {late ? <span className="text-sm font-bold text-orange">LATE</span> : null}
                    {dueSoon ? <span className="text-sm font-bold text-orange">DUE SOON</span> : null}
                    {order.notes ? <span className="text-sm">{order.notes}</span> : null}
                    <LastEdited by={order.updatedBy} />
                  </div>
                  <Field label="Status">
                    <SelectField
                      aria-label={`Status for ${order.description}`}
                      value={order.status}
                      onChange={(event) => void changeStatus(order, event.target.value as OrderStatus)}
                    >
                      {ORDER_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => startEdit(order)}>
                      Edit
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => void remove(order)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
