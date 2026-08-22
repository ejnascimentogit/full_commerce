"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { ProductForm } from "@/components/ProductForm";

export default function NovoProdutoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors().then(setVendors);
  }, []);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Novo produto</h1>
      {categories.length > 0 && <ProductForm categories={categories} vendors={vendors} />}
    </AdminShell>
  );
}
