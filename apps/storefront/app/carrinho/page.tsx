"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, calculateShipping, packageLabels, unitPriceOf } from "@ecommerce/api-client";
import type { Product, StoreSettings } from "@ecommerce/types";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export default function CarrinhoPage() {
  const { lines, setQuantity, removeItem } = useCart();
  const { customer } = useAuth();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([Promise.all(lines.map((l) => apiClient.getProduct(l.productId))), apiClient.getStoreSettings()]).then(
      ([items, s]) => {
        if (cancelled) return;
        setProducts(Object.fromEntries(items.map((p) => [p.id, p])));
        setSettings(s);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const resolvedLines = lines
    .map((line) => ({ line, product: products[line.productId] }))
    .filter((l): l is { line: (typeof lines)[number]; product: Product } => Boolean(l.product));

  const subtotal = resolvedLines.reduce(
    (sum, { line, product }) => sum + unitPriceOf(product) * line.quantity,
    0,
  );
  const shipping = customer && settings ? calculateShipping(customer, settings) : null;
  const total = subtotal + (shipping ?? 0);
  const minOrderValue = settings?.minOrderValue;
  const belowMinimum = Boolean(minOrderValue && subtotal < minOrderValue);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Meu carrinho</h1>

      {!loading && lines.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <p className="text-slate-600">Seu carrinho está vazio.</p>
          <Link href="/catalogo" className="mt-3 inline-block text-brand-600 font-medium hover:underline">
            Ir para o catálogo
          </Link>
        </div>
      )}

      {resolvedLines.length > 0 && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            {resolvedLines.map(({ line, product }) => (
              <div key={product.id} className="bg-white border border-slate-200 rounded-lg p-3 flex gap-3 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URI placeholder */}
                <img src={product.photos[0]} alt={product.name} className="w-20 h-20 object-cover rounded-md shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/produto/${product.id}`} className="font-medium text-slate-900 hover:text-brand-600 line-clamp-2">
                    {product.name}
                  </Link>
                  {packageLabels[product.id] && (
                    <p className="text-xs text-slate-500 mt-0.5">{packageLabels[product.id]}</p>
                  )}
                  <p className="text-sm text-slate-600 mt-1">
                    R$ {unitPriceOf(product).toFixed(2).replace(".", ",")}/{product.unitType}
                  </p>
                </div>
                <div className="flex items-center border border-slate-300 rounded-md shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(product.id, line.quantity - 1)}
                    className="w-8 h-9 text-slate-600 hover:bg-slate-100"
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(product.id, line.quantity + 1)}
                    className="w-8 h-9 text-slate-600 hover:bg-slate-100"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
                <p className="w-24 text-right font-semibold shrink-0">
                  R$ {(unitPriceOf(product) * line.quantity).toFixed(2).replace(".", ",")}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  aria-label={`Remover ${product.name}`}
                  className="text-slate-400 hover:text-red-600 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <aside className="bg-white border border-slate-200 rounded-lg p-4 h-fit space-y-3">
            <h2 className="font-semibold text-slate-900">Resumo do pedido</h2>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Frete</span>
                <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
                  {shipping === null
                    ? "Calculado no checkout"
                    : shipping === 0
                      ? "Grátis"
                      : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                <span>Total {shipping === null && <span className="font-normal text-xs text-slate-400">(+ frete)</span>}</span>
                <span>R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            {belowMinimum && minOrderValue && (
              <p className="text-amber-600 text-xs bg-amber-50 rounded-md px-3 py-2">
                Faltam R$ {(minOrderValue - subtotal).toFixed(2).replace(".", ",")} para o pedido mínimo de R${" "}
                {minOrderValue.toFixed(2).replace(".", ",")}.
              </p>
            )}

            {belowMinimum ? (
              <button type="button" disabled className="block w-full text-center bg-slate-200 text-slate-400 font-semibold rounded-md py-2.5 cursor-not-allowed">
                Finalizar compra
              </button>
            ) : (
              <Link
                href="/checkout"
                className="block text-center bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700"
              >
                Finalizar compra
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
