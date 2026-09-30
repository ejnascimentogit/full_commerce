import type { Cart, CartItem } from "@ecommerce/types";

// Same spirit as quotes-store.ts (persisted in localStorage, browser only, to
// survive a reload in mock mode), but keyed PER CUSTOMER instead of a single
// list -- on the real server only one active cart exists per customer_id
// (unique), so the mock mirrors that by storing the cart already resolved
// for that customer, not a loose list of carts.
function storageKey(customerId: string): string {
  return `ecommerce.mock.cart.${customerId}`;
}

// Separate index of customerIds that already have a saved cart -- needed only
// so getAdminCartsStore can "list all" without scanning the whole
// localStorage (can't safely do Object.keys(localStorage) here since other
// stores also use this same localStorage).
const INDEX_KEY = "ecommerce.mock.cart.index";

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function addToIndex(customerId: string): void {
  if (typeof window === "undefined") return;
  const ids = readIndex();
  if (!ids.includes(customerId)) localStorage.setItem(INDEX_KEY, JSON.stringify([...ids, customerId]));
}

export function readCart(customerId: string): Cart | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(customerId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeCart(customerId: string, items: CartItem[]): Cart {
  const cart: Cart = {
    id: readCart(customerId)?.id ?? `cart-${customerId}`,
    customerId,
    items,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(customerId), JSON.stringify(cart));
    addToIndex(customerId);
  }
  return cart;
}

// For getAdminCarts: every indexed cart that still has at least 1 item, most
// recent first -- same filter the real backend applies.
export function findAllCartsWithItems(): Cart[] {
  return readIndex()
    .map((id) => readCart(id))
    .filter((cart): cart is Cart => cart != null && cart.items.length > 0)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
