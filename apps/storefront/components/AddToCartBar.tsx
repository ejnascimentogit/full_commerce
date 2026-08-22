"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@ecommerce/types";
import { useCart } from "@/lib/cart-context";

export function AddToCartBar({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border border-slate-300 rounded-md">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="w-9 h-10 text-lg text-slate-600 hover:bg-slate-100"
          aria-label="Diminuir quantidade"
        >
          −
        </button>
        <span className="w-10 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          className="w-9 h-10 text-lg text-slate-600 hover:bg-slate-100"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => addItem(product.id, quantity)}
        className="flex-1 bg-brand-600 text-white font-semibold rounded-md py-2.5 hover:bg-brand-700"
      >
        Adicionar ao carrinho
      </button>
      <button
        type="button"
        onClick={() => {
          addItem(product.id, quantity);
          router.push("/carrinho");
        }}
        className="flex-1 bg-slate-900 text-white font-semibold rounded-md py-2.5 hover:bg-slate-800"
      >
        Comprar agora
      </button>
    </div>
  );
}
