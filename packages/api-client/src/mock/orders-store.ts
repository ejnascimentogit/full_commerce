import type { Order, OrderStatus } from "@ecommerce/types";
import { mockCustomer, products } from "./data";
import { buildOrderItem, calculateOrderTotals } from "../domain";

// Persisted to localStorage (browser only) so orders survive page reloads and are
// visible consistently across every client component. Server Components run in a
// separate Node process with no access to the browser's localStorage, so any page
// that needs to read orders in mock mode must be a client component ("use client")
// that calls these functions after mount — see app/conta/pedidos and app/pedido/[id].
// A real backend replaces this file entirely with actual persistence; nothing else
// in the app needs to change.
//
// Note: apps/storefront and apps/admin run on different origins in dev, so their
// localStorage does NOT share data — an order placed in the storefront won't show
// up in the admin's mock store. Both seed the same starter orders below so each
// app has something to demo independently; a real shared backend removes this gap.
const STORAGE_KEY = "ecommerce.mock.orders";
const SEQUENCE_KEY = "ecommerce.mock.orderSequence";

function buildSeedOrders(): Order[] {
  const address = mockCustomer.addresses[0];
  // mockCustomer é CNPJ e a regra padrão de frete grátis está ligada — pedidos
  // seed não dependem de StoreSettings ao vivo, então o frete é fixo em 0 aqui.
  const totals1 = calculateOrderTotals([buildOrderItem(products[1], 5), buildOrderItem(products[6], 2)], 0);
  const totals2 = calculateOrderTotals([buildOrderItem(products[0], 3)], 0);
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

  return [
    {
      id: "order-seed-1",
      orderNumber: "PED-1001",
      customerId: mockCustomer.id,
      items: [buildOrderItem(products[1], 5), buildOrderItem(products[6], 2)],
      shippingAddress: address,
      regionId: mockCustomer.regionId,
      paymentMethod: "pix",
      ...totals1,
      status: "PREPARING",
      statusHistory: [
        { status: "PENDING", changedAt: daysAgo(2) },
        { status: "PAID", changedAt: daysAgo(2) },
        { status: "PREPARING", changedAt: daysAgo(1) },
      ],
      createdAt: daysAgo(2),
    },
    {
      id: "order-seed-2",
      orderNumber: "PED-1000",
      customerId: mockCustomer.id,
      items: [buildOrderItem(products[0], 3)],
      shippingAddress: address,
      regionId: mockCustomer.regionId,
      paymentMethod: "card",
      ...totals2,
      status: "OUT_FOR_DELIVERY",
      statusHistory: [
        { status: "PENDING", changedAt: daysAgo(3) },
        { status: "PAID", changedAt: daysAgo(3) },
        { status: "PREPARING", changedAt: daysAgo(2) },
        { status: "OUT_FOR_DELIVERY", changedAt: daysAgo(1) },
      ],
      createdAt: daysAgo(3),
    },
  ];
}

function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  const seeded = buildSeedOrders();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
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

export function findAllOrders(filter?: { status?: OrderStatus; vendorId?: string }): Order[] {
  return readOrders()
    .filter((o) => {
      if (filter?.status && o.status !== filter.status) return false;
      if (filter?.vendorId && !o.items.some((i) => i.vendorId === filter.vendorId)) return false;
      return true;
    })
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
