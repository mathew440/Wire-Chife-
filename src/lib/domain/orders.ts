import type { MaterialOrder, OrderStatus } from "@/lib/data/types";
import { addDays } from "@/lib/domain/dates";
import { DUE_SOON_DAYS } from "@/lib/domain/logs";

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "needed", label: "Needed" },
  { value: "ordered", label: "Ordered" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "backordered", label: "Backordered" },
];

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function isDeliveredOrder(status: OrderStatus): boolean {
  return status === "delivered";
}

/** Expected day has passed and the order has not been marked delivered. */
export function isLateOrder(order: Pick<MaterialOrder, "status" | "expectedDate" | "deletedAt">, today: string): boolean {
  if (order.deletedAt || !order.expectedDate || isDeliveredOrder(order.status)) return false;
  return order.expectedDate < today;
}

/** Expected within 7 days, and not delivered. A missing date is not due soon. */
export function isDueSoonOrder(order: Pick<MaterialOrder, "status" | "expectedDate" | "deletedAt">, today: string): boolean {
  if (order.deletedAt || !order.expectedDate || isDeliveredOrder(order.status)) return false;
  return order.expectedDate >= today && order.expectedDate <= addDays(today, DUE_SOON_DAYS);
}
