"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@ecommerce/types";
import { packageLabels } from "@ecommerce/api-client";
import { useCart } from "@/lib/cart-context";

const unitSuffix: Record<Product["unitType"], string> = { un: "un", kg: "kg", cx: "cx" };

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const hasDiscount = product.salePrice != null && product.salePrice < product.basePrice;
  const displayPrice = product.salePrice ?? product.basePrice;
  const discountPct = hasDiscount
    ? Math.round((1 - product.salePrice! / product.basePrice) * 100)
    : 0;
  const packageLabel = packageLabels[product.id];

  function handleAdd() {
    addItem(product.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="relative bg-white rounded-lg border border-slate-200 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all flex flex-col">
      <div className="relative aspect-square min-h-0 overflow-hidden shrink-0 bg-white">
        <Link href={`/produto/${product.id}`} className="block w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data-URI placeholders, no benefit from next/image optimization */}
          <img src={product.photos[0]} alt={product.name} className="w-full h-full object-contain p-2 rounded-t-lg" />
        </Link>
        {packageLabel && (
          <span className="absolute top-2 left-2 bg-white/90 text-[11px] font-medium px-1.5 py-0.5 rounded">
            {packageLabel}
          </span>
        )}
        <button
          type="button"
          onClick={handleAdd}
          aria-label={`Adicionar ${product.name} ao carrinho`}
          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full text-lg leading-none text-white transition-colors ${justAdded ? "bg-green-600" : "bg-brand-600 hover:bg-brand-700"}`}
        >
          {justAdded ? "✓" : "+"}
        </button>
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        {hasDiscount && (
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">
              {discountPct}% OFF
            </span>
            <span className="text-slate-400 line-through">
              R$ {product.basePrice.toFixed(2).replace(".", ",")}
            </span>
          </div>
        )}
        <p className="text-lg font-bold text-slate-900">
          R$ {displayPrice.toFixed(2).replace(".", ",")}
          <span className="text-sm font-normal text-slate-500">/{unitSuffix[product.unitType]}</span>
        </p>
        <Link href={`/produto/${product.id}`} className="text-sm text-slate-600 line-clamp-2 hover:text-brand-600">
          {product.name}
        </Link>
      </div>
    </div>
  );
}
