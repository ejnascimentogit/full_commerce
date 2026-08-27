"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product, Promotion, UnitType, Vendor } from "@ecommerce/types";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { apiClient, isPromotionActive } from "@ecommerce/api-client";

interface ProductFormProps {
  product?: Product;
  categories: Category[];
  vendors: Vendor[];
}

// Além desse tamanho, o nome tende a quebrar linha na tabela da folha de
// separação impressa (/pedidos/[id]/imprimir) — a coluna "Produto" lá tem
// espaço limitado. Detalhe extra que não caiba aqui deve ir na Descrição.
const NAME_RECOMMENDED_MAX = 40;

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: "un", label: "Unidade (un)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "cx", label: "Caixa (cx)" },
];

export function ProductForm({ product, categories, vendors }: ProductFormProps) {
  const { user } = useAdminAuth();
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [customerReferenceCode, setCustomerReferenceCode] = useState(product?.customerReferenceCode ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [vendorId, setVendorId] = useState(product?.vendorId ?? (user?.role === "vendorAdmin" ? user.vendorId! : vendors[0]?.id ?? ""));
  const [unitType, setUnitType] = useState<UnitType>(product?.unitType ?? "un");
  const [basePrice, setBasePrice] = useState(product?.basePrice?.toString() ?? "");
  const [salePrice, setSalePrice] = useState(product?.salePrice?.toString() ?? "");
  const [boxQuantity, setBoxQuantity] = useState(product?.boxQuantity?.toString() ?? "");
  const [isVariableWeight, setIsVariableWeight] = useState(product?.isVariableWeight ?? false);
  const [avgWeight, setAvgWeight] = useState(product?.avgWeight?.toString() ?? "");
  const [isSeasonal, setIsSeasonal] = useState(product?.isSeasonal ?? false);
  const [stock, setStock] = useState(product?.stock?.toString() ?? "0");
  const [status, setStatus] = useState<Product["status"]>(product?.status ?? "active");
  const [photos, setPhotos] = useState<string[]>(product?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);

  // Promoções de campanha (tela Promoções) mudam o preço mostrado na loja sem
  // mexer no cadastro do produto — aqui só avisa se alguma está valendo pra
  // esse produto agora, pra não confundir com o campo "Preço promocional"
  // abaixo (que é o valor gravado direto no produto).
  useEffect(() => {
    if (!product) return;
    apiClient.getAdminPromotions().then((promotions) => {
      const match = promotions.find((promo) => {
        if (!isPromotionActive(promo) || promo.couponCode) return false;
        if (promo.type !== "percentage" && promo.type !== "fixed") return false;
        if (promo.value <= 0) return false; // sem valor, não muda preço nenhum — não vale a pena avisar
        const { productIds, categoryIds, vendorId: ruleVendorId } = promo.rules;
        if (categoryIds?.length && !categoryIds.includes(product.categoryId)) return false;
        if (ruleVendorId && product.vendorId !== ruleVendorId) return false;
        if (productIds?.length && !productIds.includes(product.id)) return false;
        return true;
      });
      setActivePromotion(match ?? null);
    });
  }, [product]);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await apiClient.uploadProductPhoto(product?.id ?? null, file);
      setPhotos((prev) => [...prev, url]);
    } catch {
      setError("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    setPhotos((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        description,
        sku,
        customerReferenceCode: customerReferenceCode || undefined,
        categoryId,
        photos,
        unitType,
        basePrice: Number(basePrice),
        salePrice: salePrice && Number(salePrice) > 0 ? Number(salePrice) : undefined,
        boxQuantity: boxQuantity ? Number(boxQuantity) : undefined,
        isVariableWeight,
        avgWeight: isVariableWeight ? Number(avgWeight) : undefined,
        isSeasonal,
        stock: Number(stock),
        variants: product?.variants ?? [],
        status,
      };

      if (product) {
        await apiClient.updateProduct(product.id, { ...payload, vendorId });
      } else {
        await apiClient.createProduct({ ...payload, vendorId });
      }
      router.push("/produtos");
    } catch {
      setError("Não foi possível salvar o produto.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Field label="Nome" value={name} onChange={setName} required />
          {/* Nome comprido demais quebra linha na folha de separação impressa — melhor manter curto e deixar detalhe extra na Descrição. */}
          <p className={`text-xs mt-1 ${name.length > NAME_RECOMMENDED_MAX ? "text-amber-600" : "text-slate-400"}`}>
            {name.length} caracteres
            {name.length > NAME_RECOMMENDED_MAX
              ? ` — acima de ${NAME_RECOMMENDED_MAX} pode quebrar linha na impressão de separação`
              : ` (recomendado até ${NAME_RECOMMENDED_MAX})`}
          </p>
        </div>
        <Field label="SKU (código do produto)" value={sku} onChange={setSku} required />
      </div>

      <Field
        label="Código de referência do cliente (opcional)"
        value={customerReferenceCode}
        onChange={setCustomerReferenceCode}
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Fotos</label>
        <div className="flex flex-wrap gap-3">
          {photos.map((url, index) => (
            <div key={url + index} className="relative w-24 h-24 rounded-md overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- local/data-URI mock photos */}
              <img src={url} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-brand-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                  Capa
                </span>
              )}
              <div className="absolute bottom-1 right-1 flex items-center gap-1">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    title="Tornar capa"
                    className="text-white text-xs bg-black/60 rounded px-1.5 py-0.5 hover:bg-black/80"
                  >
                    ★ Capa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  title="Remover"
                  className="text-white text-xs bg-black/60 rounded px-1.5 py-0.5 hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <label className="w-24 h-24 rounded-md border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs cursor-pointer hover:border-brand-400 hover:text-brand-600 text-center px-1">
            {uploading ? "Enviando..." : "+ Adicionar foto"}
            <input type="file" accept="image/*" onChange={handlePhotoSelected} disabled={uploading} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">A primeira foto é a capa exibida no catálogo. Passe o mouse para trocar ou remover.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {user?.role === "platformAdmin" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Unidade de venda</label>
          <select value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
            {UNIT_TYPES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <Field label="Unidades por caixa/fardo (opcional)" value={boxQuantity} onChange={setBoxQuantity} type="number" />
        <Field label="Estoque" value={stock} onChange={setStock} type="number" required />
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        Informativo — aparece na página do produto (ex: &quot;Caixa com 12 unidades&quot;), mesmo vendendo por unidade.
      </p>

      {activePromotion && (
        <p className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-3 py-2 flex items-center gap-1.5">
          🏷️ Este produto está com uma <strong>Promoção</strong> ativa (
          {activePromotion.type === "percentage" ? `${activePromotion.value}% off` : `R$ ${activePromotion.value.toFixed(2)} off`}
          {activePromotion.endsAt && `, até ${new Date(activePromotion.endsAt).toLocaleDateString("pt-BR")}`}) — o preço na loja já sai
          com esse desconto, independente do que estiver no campo &quot;Preço promocional&quot; abaixo.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Preço de tabela (R$)" value={basePrice} onChange={setBasePrice} type="number" required />
        <Field label="Preço promocional (R$)" value={salePrice} onChange={setSalePrice} type="number" />
      </div>
      <p className="text-xs text-slate-400 -mt-3">
        Esse campo é o preço promocional gravado direto no cadastro — diferente de uma Promoção de campanha (tela Promoções), que se
        aplica automaticamente sem mudar esse valor.
      </p>

      <div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isVariableWeight} onChange={(e) => setIsVariableWeight(e.target.checked)} />
          Peso variável (preço por kg, vendido por peça — ex: carnes, queijos)
        </label>
        {isVariableWeight && (
          <div className="mt-2 max-w-xs">
            <Field label="Peso médio (kg)" value={avgWeight} onChange={setAvgWeight} type="number" />
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isSeasonal} onChange={(e) => setIsSeasonal(e.target.checked)} />
          Produto sazonal (entra na vitrine "Produtos Sazonais" da home)
        </label>
      </div>

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Product["status"])} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="active">Ativo</option>
          <option value="draft">Rascunho</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Salvando..." : "Salvar produto"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/produtos")}
          className="text-slate-600 font-medium px-5 py-2.5 rounded-md hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={type === "number" ? "0.01" : undefined}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
