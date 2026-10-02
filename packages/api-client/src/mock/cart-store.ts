import type { Cart, CartSyncInput } from "@ecommerce/types";

// Mock em localStorage: uma lista de carrinhos POR CLIENTE, espelhando o servidor real (varios
// carrinhos, cada um identificado pelo localId; o mexido por ultimo ganha).
function storageKey(customerId: string): string {
  return `ecommerce.mock.carts.${customerId}`;
}

// Indice dos clientes que ja tem carrinho salvo -- so pra getAdminCarts conseguir "listar todos" sem
// varrer o localStorage inteiro (outras stores usam o mesmo localStorage).
const INDEX_KEY = "ecommerce.mock.carts.index";

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

function readAll(customerId: string): Cart[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(storageKey(customerId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function readCarts(customerId: string): Cart[] {
  return readAll(customerId).filter((cart) => cart.status === "open");
}

export function syncCarts(customerId: string, incoming: CartSyncInput[]): Cart[] {
  const current = readAll(customerId);
  for (const input of incoming) {
    const index = current.findIndex((cart) => cart.localId === input.localId);
    if (input.discarded) {
      if (index >= 0) current[index] = { ...current[index], status: "discarded", isActive: false };
      continue;
    }
    if (index >= 0 && current[index].status === "discarded") continue;
    if (index === -1) {
      current.push({
        id: `cart-${customerId}-${input.localId}`,
        customerId,
        localId: input.localId,
        isActive: input.isActive,
        status: "open",
        items: input.items,
        updatedAt: input.updatedAt,
      });
    } else if (Date.parse(input.updatedAt) > Date.parse(current[index].updatedAt)) {
      current[index] = { ...current[index], items: input.items, updatedAt: input.updatedAt };
    }
  }
  const activeLocalId = incoming.find((cart) => cart.isActive && !cart.discarded)?.localId;
  const next = activeLocalId ? current.map((cart) => ({ ...cart, isActive: cart.localId === activeLocalId })) : current;
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(customerId), JSON.stringify(next));
    const ids = readIndex();
    if (!ids.includes(customerId)) localStorage.setItem(INDEX_KEY, JSON.stringify([...ids, customerId]));
  }
  return next.filter((cart) => cart.status === "open");
}

// Pra getAdminCarts: todos os carrinhos abertos com pelo menos 1 item, mais recentes primeiro.
export function findAllCartsWithItems(): Cart[] {
  return readIndex()
    .flatMap((id) => readCarts(id))
    .filter((cart) => cart.items.length > 0)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
