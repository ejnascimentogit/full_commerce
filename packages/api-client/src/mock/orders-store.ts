import type { Order, OrderStatus } from "@ecommerce/types";

// Persisted to localStorage (browser only) so orders survive page reloads and are
// visible consistently across every client component. Server Components run in a
// separate Node process with no access to the browser's localStorage, so any page
// that needs to read orders in mock mode must be a client component ("use client")
// that calls these functions after mount — see app/conta/pedidos and app/pedido/[id].
// A real backend replaces this file entirely with actual persistence; nothing else
// in the app needs to change.
const STORAGE_KEY = "ecommerce.mock.orders";
const SEQUENCE_KEY = "ecommerce.mock.orderSequence";

function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeOrders(orders: Order[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function nextOrderNumber(): string {
  if (typeof window === "undefined") return "PED-0000";
  const current = Number(localStorage.getItem(SEQUENCE_KEY) ?? "1001") + 1;
  localStorage.setItem(SEQUENCE_KEY, String(current));
  return `PED-${current}`;
}

export function saveOrder(order: Order): Order {
  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);
  return order;
}

export function findOrderById(id: string): Order | undefined {
  return readOrders().find((o) => o.id === id);
}

export function findOrdersByCustomer(customerId: string): Order[] {
  return readOrders()
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function advanceOrderStatus(id: string, status: OrderStatus): Order | undefined {
  const orders = readOrders();
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = status;
  order.statusHistory.push({ status, changedAt: new Date().toISOString() });
  writeOrders(orders);
  return order;
}
