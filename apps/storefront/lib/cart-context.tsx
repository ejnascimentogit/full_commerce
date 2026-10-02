"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Cart } from "@ecommerce/types";
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

// Junta o que o servidor tem com o que existe neste aparelho, carrinho por carrinho (pelo id local).
// O mexido por ultimo ganha; carrinho que so existe no servidor (ex: deixado em outro aparelho) vira
// um carrinho pendente aqui.
function mergeServerCarts(local: StoredState, serverCarts: Cart[], syncedIds: Set<string>): StoredState {
  const carts = [...local.carts];
  for (const serverCart of serverCarts) {
    syncedIds.add(serverCart.localId);
    const lines = serverCart.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
    const index = carts.findIndex((cart) => cart.id === serverCart.localId);
    if (index === -1) {
      if (lines.length > 0) {
        carts.push({ id: serverCart.localId, createdAt: serverCart.updatedAt, updatedAt: serverCart.updatedAt, lines });
      }
    } else if (Date.parse(serverCart.updatedAt) > Date.parse(carts[index].updatedAt)) {
      carts[index] = { ...carts[index], updatedAt: serverCart.updatedAt, lines };
    }
  }
  return { ...local, carts };
}

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
  // Ids dos carrinhos que o servidor ja conhece (vieram dele ou ja foram enviados). Um carrinho que ficou
  // vazio (ex: depois do checkout) so e reenviado se o servidor ja tinha uma versao dele.
  const syncedIds = useRef<Set<string>>(new Set());
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
    syncedIds.current = new Set();

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

      // O servidor guarda TODOS os carrinhos do cliente (o ativo e os deixados pra tras), pra equipe de
      // vendas poder recuperar quem abandonou. Aqui junta o que ele ja tem com o que existe neste aparelho;
      // depois da hidratacao o efeito de sincronizacao abaixo envia o que for so local.
      let merged: StoredState = parsed;
      try {
        const serverCarts = await apiClient.getCarts();
        if (cancelled) return;
        merged = mergeServerCarts(parsed, serverCarts, syncedIds.current);
      } catch {
        // Sem servidor agora (rede, etc.) -- segue com o estado local; a sincronizacao tenta de novo
        // na proxima mudanca. O servidor nunca perde dado por isso: ele so aceita uma versao mais nova.
      }
      if (cancelled) return;

      localStorage.setItem(storageKey(currentId), JSON.stringify(merged));
      hydrated.current = true;
      setState(merged);
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

  // Sincroniza TODOS os carrinhos com o servidor (com debounce) sempre que algo muda: adicionar/remover
  // item, trocar o carrinho ativo, esvaziar apos checkout. So envia carrinho com item, ou um que o servidor
  // ja conhece (pra refletir que foi esvaziado).
  useEffect(() => {
    if (!customer || !state) return;
    if (!hydrated.current) return;
    const timer = setTimeout(() => {
      const payload = state.carts
        .filter((c) => c.lines.length > 0 || syncedIds.current.has(c.id))
        .map((c) => ({
          localId: c.id,
          items: c.lines,
          isActive: c.id === state.activeCartId,
          updatedAt: c.updatedAt,
        }));
      if (payload.length === 0) return;
      apiClient
        .syncCarts(payload)
        .then(() => payload.forEach((p) => syncedIds.current.add(p.localId)))
        .catch(() => {
          // Falha de rede/servidor nao trava a compra -- o carrinho local segue normal e a proxima
          // mudanca tenta sincronizar de novo.
        });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, customer]);

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
      apiClient
        .syncCarts([{ localId: cartId, items: [], isActive: false, updatedAt: new Date().toISOString(), discarded: true }])
        .catch(() => {});
      syncedIds.current.delete(cartId);
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
