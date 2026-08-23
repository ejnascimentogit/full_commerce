"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";

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

    localStorage.setItem(storageKey(currentId), JSON.stringify(parsed));
    setState(parsed);
    previousCustomerId.current = currentId;
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
