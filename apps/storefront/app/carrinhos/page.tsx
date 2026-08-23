"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, unitPriceOf } from "@ecommerce/api-client";
import type { Category, Product } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useCart, type SavedCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

// Tela mostrada ao clicar no ícone do carrinho, antes da lista de itens: o
// cliente pode ter mais de um carrinho (um por sessão de login em que deixou
// itens sem finalizar) — aqui ele vê todos, com data/valor/quantidade, e
// decide qual retomar ou descartar.
export default function CarrinhosPage() {
  const { customer, loading: authLoading } = useAuth();
  const router = useRouter();
  const { lines, activeCartId, pendingCarts, switchToCart, deleteCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    if (!authLoading && !customer) router.replace("/conta/entrar?redirect=/carrinhos");
  }, [authLoading, customer, router]);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  const activeCart: SavedCart | null = activeCartId
    ? { id: activeCartId, createdAt: "", updatedAt: "", lines }
    : null;
  const allCarts = activeCart && activeCart.lines.length > 0 ? [activeCart, ...pendingCarts] : pendingCarts;

  useEffect(() => {
    const ids = new Set<string>();
    allCarts.forEach((c) => c.lines.forEach((l) => ids.add(l.productId)));
    const missing = [...ids].filter((id) => !products[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map((id) => apiClient.getProduct(id))).then((fetched) => {
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(fetched.map((p) => [p.id, p])) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir a linhas novas
  }, [lines, pendingCarts]);

  function totalOf(cart: SavedCart) {
    return cart.lines.reduce((sum, l) => {
      const p = products[l.productId];
      return p ? sum + unitPriceOf(p) * l.quantity : sum;
    }, 0);
  }

  function itemCountOf(cart: SavedCart) {
    return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
  }

  function openCart(cart: SavedCart, isActive: boolean) {
    if (!isActive) switchToCart(cart.id);
    router.push("/carrinho");
  }

  if (!customer) return null;

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Meus carrinhos</h1>

        {allCarts.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
            <p className="text-slate-600">Você ainda não tem nenhum carrinho com itens.</p>
            <a href="/catalogo" className="mt-3 inline-block text-brand-600 font-medium hover:underline">
              Ir para o catálogo
            </a>
          </div>
        )}

        <div className="space-y-3">
          {allCarts.map((cart) => {
            const isActive = cart.id === activeCartId;
            return (
              <div key={cart.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {isActive ? "Carrinho atual" : `Deixado em ${new Date(cart.createdAt).toLocaleDateString("pt-BR")}`}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      R$ {totalOf(cart).toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-sm text-slate-500">
                      {itemCountOf(cart)} {itemCountOf(cart) === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  {!isActive && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full shrink-0">
                      Pendente
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openCart(cart, isActive)}
                    className="flex-1 bg-brand-600 text-white font-semibold rounded-md py-2 text-sm hover:bg-brand-700"
                  >
                    {isActive ? "Ver e finalizar" : "Continuar este carrinho"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCart(cart.id)}
                    className="text-slate-500 border border-slate-200 rounded-md px-3 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
