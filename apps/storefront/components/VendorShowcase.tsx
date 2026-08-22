import Link from "next/link";
import type { Product, Vendor } from "@ecommerce/types";
import { ProductCard } from "./ProductCard";

export function VendorShowcase({ vendor, products }: { vendor: Vendor; products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-slate-900">
          Produtos - <span className="text-brand-600">{vendor.name}</span>
        </h2>
        <Link href={`/catalogo?fornecedor=${vendor.id}`} className="text-brand-600 text-sm font-medium hover:underline">
          Ver todos
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
