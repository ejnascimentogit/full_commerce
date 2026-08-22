"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function CartBadge() {
  const { itemCount } = useCart();

  return (
    <Link href="/carrinho" aria-label="Carrinho" className="relative text-2xl">
      🛒
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-2 bg-white text-brand-700 text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
