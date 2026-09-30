"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiClient } from "@ecommerce/api-client";
import { useAuth } from "./auth-context";

const SYNC_DEBOUNCE_MS = 800;

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface SavedCart {
  id: string;
  createdAt: string;
  updatedAt: string;
  lines: CartLine[];
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  activeCartId: string | null;
  /** Outros carrinhos do cliente com itens, deixados de sessões anteriores. */
  pendingCarts: SavedCart[];
  /** Torna um carrinho pendente o carrinho ativo (ex: "continuar esse carrinho"). */
  switchToCart: (cartId: string) => void;
  /** Apaga um carrinho (ativo ou pendente) por completo. */
  deleteCart: (cartId: string) => void;
}

interface StoredState {
  activeCartId: string;
  carts: SavedCart[];
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(customerId: string) {
  return `ecommerce.carts.${customerId}`;
}

function makeCart(): SavedCart {
  const now = new Date().toISOString();
  return { id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now, updatedAt: now, lines: [] };
}

// Cada cliente pode ter mais de um carrinho: o "ativo" (onde adicionar/remover
// itens mexe) e uma lista de carrinhos "pendentes" — carrinhos com itens que
// ficaram de sessões anteriores (o cliente saiu sem finalizar a compra). A
// cada novo login, se o carrinho ativo da sessão anterior tinha itens, ele
// vira pendente e um carrinho novo, vazio, começa a ser usado — assim o
// cliente sempre vê o que ficou pra trás em vez de perder ou misturar tudo.
export function CartProvider({ children }: { children: ReactNode }) {
  const { customer, loading: authLoading } = useAuth();
  const [state, setState] = useState<StoredState | null>(null);
  const previousCustomerId = useRef<string | null | undefined>(undefined);
  // Skips the sync effect once, right after a hydration-driven setState.
  const skipNextSync = useRef(false);
  // Only true after the initial GET /cart for this customer has finished
  // (success or failure). Without this the sync effect could fire BEFORE
  // hydration completes: on first render `lines` is always [] (state starts
  // null), so without this guard an 800ms debounce would schedule an empty
  // PUT /cart racing the GET /cart -- if the GET takes longer than 800ms
  // (Edge Function cold start is a real case here, not hypothetical), the
  // empty PUT fires first and wipes the customer real server-side cart
  // before it was ever read.
  const hydrated = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    const currentId = customer?.id ?? null;
    if (currentId === previousCustomerId.current) return;
    const wasLoggedOut = previousCustomerId.current == null;

    if (!currentId) {
      setState(null);
      previousCustomerId.current = null;
      return;
    }

    let cancelled = false;
    hydrated.current = false;

    (async () => {
      const raw = localStorage.getItem(storageKey(currentId));
      let parsed: StoredState | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }

      if (!parsed || parsed.carts.length === 0) {
        const cart = makeCart();
        parsed = { activeCartId: cart.id, carts: [cart] };
      } else if (wasLoggedOut) {
        const active = parsed.carts.find((c) => c.id === parsed!.activeCartId);
        if (active && active.lines.length > 0) {
          const cart = makeCart();
          parsed = { activeCartId: cart.id, carts: [cart, ...parsed.carts] };
        }
      }

      // The server is the source of truth for the ACTIVE cart from here on --
      // the other saved carts (pendingCarts) stay fully local. If the server
      // already has a cart (another device, or a previous sync), it replaces
      // the local active cart lines; if it has nothing yet, whatever exists
      // locally is sent there now, so nothing is lost on this first sync.
      try {
        const serverCart = await apiClient.getCart();
        if (cancelled) return;
        if (serverCart) {
          parsed = {
            ...parsed,
            carts: parsed.carts.map((c) =>
              c.id === parsed!.activeCartId
                ? {
                    ...c,
                    lines: serverCart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                    updatedAt: serverCart.updatedAt,
                  }
                : c,
            ),
          };
        } else {
          const active = parsed.carts.find((c) => c.id === parsed!.activeCartId);
          if (active && active.lines.length > 0) {
            await apiClient.updateCart(active.lines);
          }
        }
      } catch {
        // No server available right now (network, etc.) -- keep going with
        // local state only; sync is retried on the next cart change.
      }
      if (cancelled) return;

      localStorage.setItem(storageKey(currentId), JSON.stringify(parsed));
      skipNextSync.current = true;
      hydrated.current = true;
      setState(parsed);
      previousCustomerId.current = currentId;
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, authLoading]);

  function persist(next: StoredState) {
    setState(next);
    if (customer) localStorage.setItem(storageKey(customer.id), JSON.stringify(next));
  }

  function updateActiveLines(updater: (lines: CartLine[]) => CartLine[]) {
    if (!state) return;
    const now = new Date().toISOString();
    const carts = state.carts.map((c) => (c.id === state.activeCartId ? { ...c, lines: updater(c.lines), updatedAt: now } : c));
    persist({ ...state, carts });
  }

  const activeCart = state?.carts.find((c) => c.id === state.activeCartId) ?? null;
  const lines = activeCart?.lines ?? [];
  const pendingCarts = (state?.carts ?? []).filter((c) => c.id !== state?.activeCartId && c.lines.length > 0);

  useEffect(() => {
    if (!customer) return;
    if (!hydrated.current) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const timer = setTimeout(() => {
      apiClient.updateCart(lines).catch(() => {
        // Network/server failure should not block the shopping experience --
        // the local cart keeps working; the next change retries the sync.
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, customer]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      addItem: (productId, quantity = 1) =>
        updateActiveLines((prev) => {
          const existing = prev.find((l) => l.productId === productId);
          if (existing) {
            return prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l));
          }
          return [...prev, { productId, quantity }];
        }),
      removeItem: (productId) => updateActiveLines((prev) => prev.filter((l) => l.productId !== productId)),
      setQuantity: (productId, quantity) =>
        updateActiveLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.productId !== productId)
            : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
        ),
      clear: () => updateActiveLines(() => []),
      activeCartId: state?.activeCartId ?? null,
      pendingCarts,
      switchToCart: (cartId) => {
        if (!state) return;
        persist({ ...state, activeCartId: cartId });
      },
      deleteCart: (cartId) => {
        if (!state) return;
        let carts = state.carts.filter((c) => c.id !== cartId);
        let activeCartId = state.activeCartId;
        if (cartId === state.activeCartId) {
          const fresh = makeCart();
          carts = [fresh, ...carts];
          activeCartId = fresh.id;
        }
        persist({ activeCartId, carts });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state cobre lines/pendingCarts derivados
    [state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
