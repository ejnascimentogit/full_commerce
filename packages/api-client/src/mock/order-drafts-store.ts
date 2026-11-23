import type { OrderDraft, OrderDraftData } from "@ecommerce/types";

// Rascunhos de pedido do mock (só demonstração, em localStorage). No backend real vivem na tabela ecommerce.order_drafts.
const STORAGE_KEY = "ecommerce.mock.orderDrafts";

type StoredDraft = OrderDraft & { adminId: string };

function readAll(): StoredDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAll(drafts: StoredDraft[]): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listDrafts(adminId: string): OrderDraft[] {
  return readAll()
    .filter((d) => d.adminId === adminId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ adminId: _adminId, ...d }) => d);
}

export function saveDraft(adminId: string, id: string, customerId: string, data: OrderDraftData): OrderDraft {
  const drafts = readAll().filter((d) => d.id !== id);
  const draft: StoredDraft = { id, adminId, customerId, data, updatedAt: new Date().toISOString() };
  drafts.push(draft);
  writeAll(drafts);
  const { adminId: _adminId, ...out } = draft;
  return out;
}

export function deleteDraft(adminId: string, id: string): void {
  writeAll(readAll().filter((d) => !(d.id === id && d.adminId === adminId)));
}
