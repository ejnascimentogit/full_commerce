"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, Promotion, PromotionType, Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useAdminAuth } from "@/lib/admin-auth-context";

const TYPE_LABEL: Record<PromotionType, string> = {
  percentage: "% de desconto",
  fixed: "R$ de desconto",
  freeShipping: "Frete grátis",
  coupon: "Cupom",
};

function toLocalInput(iso: string): string {
  return iso ? iso.slice(0, 16) : "";
}

export default function PromocoesPage() {
  const { user } = useAdminAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<PromotionType>("percentage");
  const [value, setValue] = useState("10");
  const [couponCode, setCouponCode] = useState("");
  const [isFeatured, setIsFeatured] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    if (!user) return;
    const filterVendorId = user.role === "vendorAdmin" ? user.vendorId : undefined;
    apiClient.getAdminPromotions({ vendorId: filterVendorId }).then(setPromotions);
  }

  useEffect(refresh, [user]);
  useEffect(() => {
    apiClient.getCategories().then(setCategories);
    if (user?.role === "platformAdmin") apiClient.getVendors({ includeInactive: true }).then(setVendors);
  }, [user]);

  useEffect(() => {
    if (!productQuery.trim()) {
      setProductResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      apiClient.getProducts({ q: productQuery, pageSize: 8 }).then((r) => setProductResults(r.items));
    }, 250);
    return () => clearTimeout(timeout);
  }, [productQuery]);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function addProduct(product: Product) {
    setSelectedProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
    setProductQuery("");
    setProductResults([]);
  }

  function removeProduct(id: string) {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function resetForm() {
    setEditingId(null);
    setType("percentage");
    setValue("10");
    setCouponCode("");
    setIsFeatured(true);
    setStartsAt("");
    setEndsAt("");
    setMaxUses("");
    setMinOrderValue("");
    setCategoryIds([]);
    setVendorId("");
    setSelectedProducts([]);
    setProductQuery("");
    setProductResults([]);
  }

  async function startEdit(promotion: Promotion) {
    setEditingId(promotion.id);
    setType(promotion.type);
    setValue(String(promotion.value));
    setCouponCode(promotion.couponCode ?? "");
    setIsFeatured(promotion.isFeatured);
    setStartsAt(toLocalInput(promotion.startsAt));
    setEndsAt(toLocalInput(promotion.endsAt));
    setMaxUses(promotion.maxUses ? String(promotion.maxUses) : "");
    setMinOrderValue(promotion.rules.minOrderValue ? String(promotion.rules.minOrderValue) : "");
    setCategoryIds(promotion.rules.categoryIds ?? []);
    setVendorId(promotion.rules.vendorId ?? "");
    setProductQuery("");
    setProductResults([]);
    const productIds = promotion.rules.productIds ?? [];
    setSelectedProducts(productIds.length > 0 ? await Promise.all(productIds.map((id) => apiClient.getProduct(id))) : []);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      type,
      value: Number(value),
      couponCode: couponCode || undefined,
      isFeatured,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      maxUses: maxUses ? Number(maxUses) : undefined,
      rules: {
        minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        productIds: selectedProducts.length > 0 ? selectedProducts.map((p) => p.id) : undefined,
        vendorId: user?.role === "vendorAdmin" ? user.vendorId : vendorId || undefined,
      },
    };
    if (editingId) {
      await apiClient.updatePromotion(editingId, payload);
    } else {
      await apiClient.createPromotion(payload);
    }
    setShowForm(false);
    resetForm();
    setSubmitting(false);
    refresh();
  }

  async function endNow(promotion: Promotion) {
    await apiClient.updatePromotion(promotion.id, { endsAt: new Date().toISOString() });
    refresh();
  }

  async function toggleFeatured(promotion: Promotion) {
    await apiClient.updatePromotion(promotion.id, { isFeatured: !promotion.isFeatured });
    refresh();
  }

  const now = new Date().toISOString();

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Promoções</h1>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "+ Nova promoção"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl space-y-4">
          {editingId && <p className="text-sm font-medium text-brand-700 bg-brand-50 rounded-md px-3 py-2">Editando promoção existente</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as PromotionType)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                {Object.entries(TYPE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {type !== "freeShipping" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {type === "percentage" ? "Percentual (%)" : "Valor (R$)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código do cupom (opcional)</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Deixe em branco para aplicar automático, sem código"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fim</label>
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                Valor mínimo do pedido (opcional)
                <InfoTooltip text="A promoção só aplica desconto se o subtotal do carrinho for maior ou igual a esse valor. Abaixo disso, não desconta nada (não bloqueia a compra). Vazio = sem mínimo." />
              </label>
              <input
                type="number"
                step="0.01"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                Limite de usos (opcional)
                <InfoTooltip text="Quantas vezes essa promoção pode ser usada no total, somando todos os clientes. Ao atingir o número, ela para de valer sozinha, mesmo dentro do prazo. Vazio = uso ilimitado." />
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Restringir a produtos específicos (opcional)</label>
            <div className="relative">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Buscar por nome ou código do produto (SKU)"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              {productResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-sm max-h-48 overflow-y-auto">
                  {productResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedProducts.map((p) => (
                  <span key={p.id} className="text-xs px-2.5 py-1 rounded-full bg-brand-50 border border-brand-300 text-brand-700 flex items-center gap-1.5">
                    {p.name}
                    <button type="button" onClick={() => removeProduct(p.id)} className="text-brand-500 hover:text-brand-800">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">Nenhum selecionado = não restringe por produto.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Restringir a categorias (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${categoryIds.includes(c.id) ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">Nenhuma marcada = aplica em todas as categorias.</p>
          </div>

          {user?.role === "platformAdmin" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Restringir a um fornecedor (opcional)</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="">Todos os fornecedores</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Destacar na vitrine &quot;Ofertas da Semana&quot; da home
          </label>

          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 hover:bg-brand-700 disabled:opacity-50">
            {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Criar promoção"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Valor</th>
              <th className="text-left px-4 py-2.5">Cupom</th>
              <th className="text-left px-4 py-2.5">Vigência</th>
              <th className="text-left px-4 py-2.5">Usos</th>
              <th className="text-left px-4 py-2.5">Destaque</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promotions.map((p) => {
              const active = p.startsAt <= now && p.endsAt >= now;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 text-slate-900">{TYPE_LABEL[p.type]}</td>
                  <td className="px-4 py-2.5">{p.type === "freeShipping" ? "—" : p.type === "percentage" ? `${p.value}%` : `R$ ${p.value.toFixed(2)}`}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.couponCode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {toLocalInput(p.startsAt).replace("T", " ")} até {toLocalInput(p.endsAt).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {p.currentUses}
                    {p.maxUses ? ` / ${p.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(p)}
                      className={`text-xs px-2 py-0.5 rounded-full ${p.isFeatured ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {p.isFeatured ? "Em destaque" : "Não destacado"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {active ? "Ativa" : "Encerrada"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => startEdit(p)} className="text-brand-600 hover:underline text-xs mr-3">
                      Editar
                    </button>
                    {active && (
                      <button type="button" onClick={() => endNow(p)} className="text-red-600 hover:underline text-xs">
                        Encerrar agora
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {promotions.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhuma promoção cadastrada.</p>}
      </div>
    </AdminShell>
  );
}
