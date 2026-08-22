"use client";

import { use, useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { ProductForm } from "@/components/ProductForm";

export default function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiClient.getProduct(id).then(setProduct);
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors().then(setVendors);
  }, [id]);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Editar produto</h1>
      {product && categories.length > 0 && <ProductForm product={product} categories={categories} vendors={vendors} />}
    </AdminShell>
  );
}
