"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, unitPriceOf } from "@ecommerce/api-client";
import type { Product } from "@ecommerce/types";
import { useCart } from "@/lib/cart-context";

export function CartBadge() {
  const { lines, itemCount, pendingCarts } = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    const missingIds = lines.map((l) => l.productId).filter((id) => !products[id]);
    if (missingIds.length === 0) return;
    Promise.all(missingIds.map((id) => apiClient.getProduct(id))).then((fetched) => {
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(fetched.map((p) => [p.id, p])) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir a linhas novas, não ao cache de products
  }, [lines]);

  const total = lines.reduce((sum, l) => {
    const product = products[l.productId];
    return product ? sum + unitPriceOf(product) * l.quantity : sum;
  }, 0);

  return (
    <Link href="/carrinhos" aria-label="Carrinho" className="relative flex items-center gap-2">
      <span className="text-2xl leading-none">🛒</span>
      {itemCount > 0 && (
        <>
          <span className="absolute -top-1.5 -left-1.5 bg-white text-brand-700 text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {itemCount}
          </span>
          <span className="text-sm font-semibold text-white">R$ {total.toFixed(2).replace(".", ",")}</span>
        </>
      )}
      {itemCount === 0 && pendingCarts.length > 0 && (
        <span
          className="absolute -top-1 -left-1 bg-amber-400 rounded-full w-3 h-3 border-2 border-brand-600"
          title={`${pendingCarts.length} carrinho(s) pendente(s)`}
        />
      )}
    </Link>
  );
}
